import { spawnSync } from 'node:child_process';
import type { LoadedManifest } from './manifest.js';
import { joinRoot } from './paths.js';
import { pathExists } from './pkg.js';
import type { GitCell } from './types.js';
import { commitCountLabel, plainGitError, whyNotPush } from './writeGate.js';

export function runGit(cwd: string, args: string[]): { ok: boolean; stdout: string; stderr: string } {
	const result = spawnSync('git', ['-C', cwd, ...args], {
		encoding: 'utf8',
		windowsHide: true,
	});
	const stdout = result.stdout ?? '';
	const stderr = result.stderr ?? '';
	if (result.error) {
		return { ok: false, stdout, stderr: result.error.message };
	}
	if (result.status !== 0) {
		return { ok: false, stdout, stderr: stderr.trim() || `git ${args.join(' ')} exited ${result.status}` };
	}
	return { ok: true, stdout, stderr };
}

function parseAheadBehind(header: string): { ahead: number | null; behind: number | null } {
	const ahead = /ahead (\d+)/.exec(header);
	const behind = /behind (\d+)/.exec(header);
	const hasUpstream = header.includes('...');
	return {
		ahead: ahead ? Number(ahead[1]) : hasUpstream ? 0 : null,
		behind: behind ? Number(behind[1]) : hasUpstream ? 0 : null,
	};
}

export function readGit(projectRoot: string, fetch = false): GitCell {
	// A failed fetch must not hide the local truth (branch, dirt, ahead/behind).
	let fetchError: string | undefined;
	if (fetch) {
		const fetched = runGit(projectRoot, ['fetch', '--quiet', 'origin']);
		if (!fetched.ok && !/no such remote|does not exist/i.test(fetched.stderr)) {
			fetchError = fetched.stderr;
		}
	}

	const status = runGit(projectRoot, ['status', '--porcelain=v1', '-b']);
	if (!status.ok) {
		if (/not a git repository/i.test(status.stderr)) {
			return { repo: false, dirty: false, staged: 0, unstaged: 0, untracked: 0, ahead: null, behind: null };
		}
		return {
			repo: true,
			dirty: false,
			staged: 0,
			unstaged: 0,
			untracked: 0,
			ahead: null,
			behind: null,
			...(fetchError ? { fetchError } : {}),
			error: status.stderr,
		};
	}

	const lines = status.stdout.split(/\r?\n/).filter((line) => line.length > 0);
	const header = lines[0] ?? '';
	const body = lines.slice(1);
	let staged = 0;
	let unstaged = 0;
	let untracked = 0;
	for (const line of body) {
		if (line.startsWith('??')) {
			untracked += 1;
			continue;
		}
		const x = line[0] ?? ' ';
		const y = line[1] ?? ' ';
		if (x !== ' ' && x !== '?') staged += 1;
		if (y !== ' ' && y !== '?') unstaged += 1;
	}

	const remotes = runGit(projectRoot, ['remote', '-v']);
	let origin: string | undefined;
	let backup: string | undefined;
	if (remotes.ok) {
		for (const line of remotes.stdout.split(/\r?\n/)) {
			const m = /^(\S+)\s+(\S+)\s+\(fetch\)$/.exec(line);
			if (!m) continue;
			if (m[1] === 'origin') origin = m[2];
			if (m[1] === 'backup') backup = m[2];
		}
	}

	const detached = /HEAD \(no branch\)|detached/i.test(header);
	const branchMatch = /^## ([^.[\s]+)/.exec(header);
	const { ahead, behind } = parseAheadBehind(header);
	let busy: string | undefined;
	if (header.includes('revert')) busy = 'revert';
	if (/rebasing|rebase/i.test(header)) busy = 'rebase';
	if (/merging|merge/i.test(header)) busy = 'merge';

	return {
		repo: true,
		branch: detached ? undefined : branchMatch?.[1],
		dirty: staged + unstaged + untracked > 0,
		staged,
		unstaged,
		untracked,
		ahead,
		behind,
		origin,
		backup,
		detached,
		busy,
		...(fetchError ? { fetchError } : {}),
	};
}

function resolveVersionCommit(cwd: string, version: string): string | null {
	for (const ref of [`v${version}`, version]) {
		const tag = runGit(cwd, ['rev-parse', '--verify', `${ref}^{commit}`]);
		if (tag.ok) {
			const hash = tag.stdout.trim();
			if (hash) return hash;
		}
	}
	for (const needle of [`"version": "${version}"`, `"version":"${version}"`]) {
		const found = runGit(cwd, ['log', '-1', '--format=%H', '-S', needle, '--', 'package.json']);
		if (found.ok) {
			const hash = found.stdout.trim();
			if (hash) return hash;
		}
	}
	return null;
}

/** Commits on origin/<branch> after the last bump of this version (or v-tag). Null if unknown. */
export function countCommitsSinceVersion(cwd: string, version: string, branch?: string): number | null {
	const ver = version.trim();
	if (!ver || !branch) return null;
	const base = resolveVersionCommit(cwd, ver);
	if (!base) return null;
	const tipRef = `origin/${branch}`;
	const tip = runGit(cwd, ['rev-parse', '--verify', tipRef]);
	if (!tip.ok) return null;
	const counted = runGit(cwd, ['rev-list', '--count', `${base}..${tipRef}`]);
	if (!counted.ok) return null;
	const n = Number(counted.stdout.trim());
	return Number.isFinite(n) ? n : null;
}

export type GitJobRow = {
	id: string;
	path: string;
	action: 'fetch' | 'pull' | 'push' | 'skip';
	reason?: string;
	stdout?: string;
	stderr?: string;
	remote?: string;
	origin?: string;
	branch?: string;
	ahead?: number | null;
};

export function requirePushIds(ids: string[]): string[] {
	const named = ids.map((id) => id.trim()).filter((id) => id.length > 0);
	if (named.length === 0) {
		throw new Error('name the project id(s) to push. LocalHelm will not push the whole fleet in one apply.');
	}
	return named;
}

export async function planFetch(loaded: LoadedManifest, onlyIds?: string[]): Promise<GitJobRow[]> {
	const only = onlyIds?.length ? new Set(onlyIds) : null;
	const rows: GitJobRow[] = [];
	for (const project of loaded.manifest.projects) {
		if (only && !only.has(project.id)) continue;
		const abs = joinRoot(loaded.workspaceRoot, project.path);
		if (!(await pathExists(abs))) {
			rows.push({ id: project.id, path: project.path, action: 'skip', reason: 'missing' });
			continue;
		}
		const git = readGit(abs);
		if (!git.repo) {
			rows.push({ id: project.id, path: project.path, action: 'skip', reason: 'no git' });
			continue;
		}
		if (!git.origin) {
			rows.push({ id: project.id, path: project.path, action: 'skip', reason: 'no origin' });
			continue;
		}
		rows.push({ id: project.id, path: project.path, action: 'fetch' });
	}
	return rows;
}

export function applyFetch(workspaceRoot: string, row: GitJobRow): GitJobRow {
	if (row.action !== 'fetch') return row;
	const abs = joinRoot(workspaceRoot, row.path);
	const result = runGit(abs, ['fetch', 'origin']);
	return { ...row, stdout: result.stdout.trim(), stderr: result.stderr, reason: result.ok ? 'fetched' : result.stderr };
}

export async function planPull(loaded: LoadedManifest, onlyIds?: string[]): Promise<GitJobRow[]> {
	const only = onlyIds?.length ? new Set(onlyIds) : null;
	const rows: GitJobRow[] = [];
	for (const project of loaded.manifest.projects) {
		if (only && !only.has(project.id)) continue;
		const abs = joinRoot(loaded.workspaceRoot, project.path);
		if (!(await pathExists(abs))) {
			rows.push({ id: project.id, path: project.path, action: 'skip', reason: 'missing' });
			continue;
		}
		const git = readGit(abs);
		if (!git.repo) {
			rows.push({ id: project.id, path: project.path, action: 'skip', reason: 'no git' });
			continue;
		}
		if (git.dirty) {
			rows.push({ id: project.id, path: project.path, action: 'skip', reason: 'dirty' });
			continue;
		}
		if (git.busy) {
			rows.push({ id: project.id, path: project.path, action: 'skip', reason: git.busy });
			continue;
		}
		if (!git.origin) {
			rows.push({ id: project.id, path: project.path, action: 'skip', reason: 'no origin' });
			continue;
		}
		if (git.behind == null) {
			rows.push({ id: project.id, path: project.path, action: 'skip', reason: 'no upstream' });
			continue;
		}
		if (git.behind === 0) {
			rows.push({ id: project.id, path: project.path, action: 'skip', reason: 'not behind' });
			continue;
		}
		if ((git.ahead ?? 0) > 0) {
			rows.push({ id: project.id, path: project.path, action: 'skip', reason: 'diverged' });
			continue;
		}
		rows.push({ id: project.id, path: project.path, action: 'pull' });
	}
	return rows;
}

export function applyPull(workspaceRoot: string, row: GitJobRow): GitJobRow {
	if (row.action !== 'pull') return row;
	const abs = joinRoot(workspaceRoot, row.path);
	const result = runGit(abs, ['pull', '--ff-only']);
	return {
		...row,
		stdout: result.stdout.trim(),
		stderr: result.stderr,
		reason: result.ok ? 'pulled ff-only' : result.stderr,
	};
}

function planPushOne(id: string, relPath: string, abs: string): GitJobRow {
	const git = readGit(abs);
	const base: GitJobRow = {
		id,
		path: relPath,
		action: 'skip',
		origin: git.origin,
		branch: git.branch,
		ahead: git.ahead,
		remote: 'origin',
	};
	const blocked = whyNotPush(git);
	if (blocked) return { ...base, reason: blocked };
	const dirt = git.dirty ? ' · uncommitted files stay local' : '';
	return {
		...base,
		action: 'push',
		reason: `${commitCountLabel(git.ahead) || git.ahead} on ${git.branch} → ${git.origin}${dirt}`,
	};
}

export async function planPush(loaded: LoadedManifest, onlyIds?: string[]): Promise<GitJobRow[]> {
	const rows: GitJobRow[] = [];
	if (onlyIds?.length) {
		for (const id of onlyIds) {
			const project = loaded.manifest.projects.find((p) => p.id === id);
			if (!project) {
				rows.push({ id, path: '', action: 'skip', reason: 'not enrolled' });
				continue;
			}
			const abs = joinRoot(loaded.workspaceRoot, project.path);
			if (!(await pathExists(abs))) {
				rows.push({ id: project.id, path: project.path, action: 'skip', reason: 'missing' });
				continue;
			}
			rows.push(planPushOne(project.id, project.path, abs));
		}
		return rows;
	}
	for (const project of loaded.manifest.projects) {
		const abs = joinRoot(loaded.workspaceRoot, project.path);
		if (!(await pathExists(abs))) {
			rows.push({ id: project.id, path: project.path, action: 'skip', reason: 'missing' });
			continue;
		}
		rows.push(planPushOne(project.id, project.path, abs));
	}
	return rows;
}

export function applyPush(workspaceRoot: string, row: GitJobRow): GitJobRow {
	if (row.action !== 'push') return row;
	if (!row.branch) return { ...row, action: 'skip', reason: 'no branch' };
	const abs = joinRoot(workspaceRoot, row.path);
	// origin + current branch only. Never --force, never backup, never extra remotes.
	const result = runGit(abs, ['push', 'origin', row.branch]);
	return {
		...row,
		stdout: result.stdout.trim(),
		stderr: result.stderr,
		reason: result.ok ? 'pushed' : plainGitError(result.stderr),
	};
}
