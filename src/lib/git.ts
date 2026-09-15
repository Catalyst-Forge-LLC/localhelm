import { spawn, spawnSync } from 'node:child_process';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import type { LoadedManifest } from './manifest.js';
import { mapPool } from './npm.js';
import { joinRoot } from './paths.js';
import { pathExists } from './pkg.js';
import type { GitCell } from './types.js';
import { commitCountLabel, plainGitError, whyNotPush } from './writeGate.js';

export const GIT_POOL = 8;

export type GitRun = { ok: boolean; stdout: string; stderr: string };

const READ_ENV = { ...process.env, GIT_OPTIONAL_LOCKS: '0' };

function gitResult(status: number | null, stdout: string, stderr: string, error?: Error, args?: string[]): GitRun {
	if (error) return { ok: false, stdout, stderr: error.message };
	if (status !== 0) {
		return { ok: false, stdout, stderr: stderr.trim() || `git ${args?.join(' ') ?? ''} exited ${status}` };
	}
	return { ok: true, stdout, stderr };
}

function spawnGitSync(cwd: string, args: string[], readOnly: boolean): GitRun {
	const result = spawnSync('git', readOnly ? ['--no-optional-locks', '-C', cwd, ...args] : ['-C', cwd, ...args], {
		encoding: 'utf8',
		windowsHide: true,
		env: readOnly ? READ_ENV : process.env,
	});
	return gitResult(result.status, result.stdout ?? '', result.stderr ?? '', result.error, args);
}

function spawnGitAsync(cwd: string, args: string[], readOnly: boolean): Promise<GitRun> {
	return new Promise((resolve) => {
		const child = spawn(
			'git',
			readOnly ? ['--no-optional-locks', '-C', cwd, ...args] : ['-C', cwd, ...args],
			{ windowsHide: true, env: readOnly ? READ_ENV : process.env },
		);
		const out: Buffer[] = [];
		const err: Buffer[] = [];
		child.stdout?.on('data', (chunk: Buffer) => {
			out.push(chunk);
		});
		child.stderr?.on('data', (chunk: Buffer) => {
			err.push(chunk);
		});
		child.on('error', (error) => {
			resolve(gitResult(1, '', '', error, args));
		});
		child.on('close', (code) => {
			resolve(
				gitResult(code, Buffer.concat(out).toString('utf8'), Buffer.concat(err).toString('utf8'), undefined, args),
			);
		});
	});
}

export function runGit(cwd: string, args: string[]): GitRun {
	return spawnGitSync(cwd, args, false);
}

export function runGitAsync(cwd: string, args: string[]): Promise<GitRun> {
	return spawnGitAsync(cwd, args, false);
}

export function runGitRead(cwd: string, args: string[]): GitRun {
	return spawnGitSync(cwd, args, true);
}

export function runGitReadAsync(cwd: string, args: string[]): Promise<GitRun> {
	return spawnGitAsync(cwd, args, true);
}

/** Origin/backup fetch URLs from a git config body. */
export function parseRemoteFetchUrls(config: string): { origin?: string; backup?: string } {
	let section = '';
	let origin: string | undefined;
	let backup: string | undefined;
	for (const raw of config.split(/\r?\n/)) {
		const line = raw.trim();
		const remote = /^\[remote "([^"]+)"\]$/.exec(line);
		if (remote) {
			section = remote[1] ?? '';
			continue;
		}
		if (line.startsWith('[')) {
			section = '';
			continue;
		}
		const url = /^url\s*=\s*(.+)$/.exec(line);
		if (!url || (section !== 'origin' && section !== 'backup')) continue;
		const value = url[1]?.trim();
		if (!value) continue;
		if (section === 'origin') origin = value;
		if (section === 'backup') backup = value;
	}
	return { origin, backup };
}

export function resolveGitCommonDir(projectRoot: string): string | null {
	const gitPath = path.join(projectRoot, '.git');
	if (!existsSync(gitPath)) return null;
	let gitdir = gitPath;
	if (!statSync(gitPath).isDirectory()) {
		const text = readFileSync(gitPath, 'utf8');
		const marker = /^gitdir:\s*(.+)\s*$/m.exec(text);
		if (!marker?.[1]) return null;
		gitdir = path.isAbsolute(marker[1].trim()) ? marker[1].trim() : path.resolve(projectRoot, marker[1].trim());
	}
	const commonFile = path.join(gitdir, 'commondir');
	if (existsSync(commonFile)) {
		return path.resolve(gitdir, readFileSync(commonFile, 'utf8').trim());
	}
	return gitdir;
}

function remotesFromConfig(projectRoot: string): { origin?: string; backup?: string } {
	const gitdir = resolveGitCommonDir(projectRoot);
	if (!gitdir) return {};
	const file = path.join(gitdir, 'config');
	if (!existsSync(file)) return {};
	return parseRemoteFetchUrls(readFileSync(file, 'utf8'));
}

async function remotesFromConfigAsync(projectRoot: string): Promise<{ origin?: string; backup?: string }> {
	const gitPath = path.join(projectRoot, '.git');
	try {
		const gitStat = await stat(gitPath);
		let gitdir = gitPath;
		if (!gitStat.isDirectory()) {
			const text = await readFile(gitPath, 'utf8');
			const marker = /^gitdir:\s*(.+)\s*$/m.exec(text);
			if (!marker?.[1]) return {};
			gitdir = path.isAbsolute(marker[1].trim()) ? marker[1].trim() : path.resolve(projectRoot, marker[1].trim());
		}
		try {
			const common = (await readFile(path.join(gitdir, 'commondir'), 'utf8')).trim();
			gitdir = path.resolve(gitdir, common);
		} catch {
			// Regular repo: gitdir is already the common dir.
		}
		return parseRemoteFetchUrls(await readFile(path.join(gitdir, 'config'), 'utf8'));
	} catch {
		return {};
	}
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

function fetchFailedReason(fetched: GitRun): string | undefined {
	if (!fetched.ok && !/no such remote|does not exist/i.test(fetched.stderr)) return fetched.stderr;
	return undefined;
}

function gitFromStatus(
	status: GitRun,
	remotes: { origin?: string; backup?: string },
	fetchError?: string,
): GitCell {
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

	const origin = remotes.origin;
	const backup = remotes.backup;

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

export function readGit(projectRoot: string, fetch = false): GitCell {
	// A failed fetch must not hide the local truth (branch, dirt, ahead/behind).
	let fetchError: string | undefined;
	if (fetch) fetchError = fetchFailedReason(runGit(projectRoot, ['fetch', '--quiet', 'origin']));
	const status = runGitRead(projectRoot, ['status', '--porcelain=v1', '-b']);
	const remotes = status.ok ? remotesFromConfig(projectRoot) : {};
	return gitFromStatus(status, remotes, fetchError);
}

export async function readGitAsync(projectRoot: string, fetch = false): Promise<GitCell> {
	let fetchError: string | undefined;
	if (fetch) fetchError = fetchFailedReason(await runGitAsync(projectRoot, ['fetch', '--quiet', 'origin']));
	const status = await runGitReadAsync(projectRoot, ['status', '--porcelain=v1', '-b']);
	const remotes = status.ok ? await remotesFromConfigAsync(projectRoot) : {};
	return gitFromStatus(status, remotes, fetchError);
}

async function resolveVersionCommit(cwd: string, version: string): Promise<string | null> {
	for (const ref of [`v${version}`, version]) {
		const tag = await runGitReadAsync(cwd, ['rev-parse', '--verify', '--quiet', `${ref}^{commit}`]);
		if (tag.ok) {
			const hash = tag.stdout.trim();
			if (hash) return hash;
		}
	}
	for (const needle of [`"version": "${version}"`, `"version":"${version}"`]) {
		const found = await runGitReadAsync(cwd, ['log', '-1', '--format=%H', '-S', needle, '--', 'package.json']);
		if (found.ok) {
			const hash = found.stdout.trim();
			if (hash) return hash;
		}
	}
	return null;
}

/** Commits on origin/<branch> after the last bump of this version (or v-tag). Null if unknown. */
export async function countCommitsSinceVersion(cwd: string, version: string, branch?: string): Promise<number | null> {
	const ver = version.trim();
	if (!ver || !branch) return null;
	const base = await resolveVersionCommit(cwd, ver);
	if (!base) return null;
	const tipRef = `origin/${branch}`;
	const counted = await runGitReadAsync(cwd, ['rev-list', '--count', `${base}..${tipRef}`]);
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
	const listed = loaded.manifest.projects.filter((project) => !only || only.has(project.id));
	return mapPool(listed, GIT_POOL, async (project) => {
		const abs = joinRoot(loaded.workspaceRoot, project.path);
		if (!(await pathExists(abs))) {
			return { id: project.id, path: project.path, action: 'skip' as const, reason: 'missing' };
		}
		const git = await readGitAsync(abs);
		if (!git.repo) return { id: project.id, path: project.path, action: 'skip' as const, reason: 'no git' };
		if (!git.origin) return { id: project.id, path: project.path, action: 'skip' as const, reason: 'no origin' };
		return { id: project.id, path: project.path, action: 'fetch' as const };
	});
}

export function applyFetch(workspaceRoot: string, row: GitJobRow): GitJobRow {
	if (row.action !== 'fetch') return row;
	const abs = joinRoot(workspaceRoot, row.path);
	const result = runGit(abs, ['fetch', 'origin']);
	return { ...row, stdout: result.stdout.trim(), stderr: result.stderr, reason: result.ok ? 'fetched' : result.stderr };
}

export async function applyFetchAsync(workspaceRoot: string, row: GitJobRow): Promise<GitJobRow> {
	if (row.action !== 'fetch') return row;
	const abs = joinRoot(workspaceRoot, row.path);
	const result = await runGitAsync(abs, ['fetch', 'origin']);
	return { ...row, stdout: result.stdout.trim(), stderr: result.stderr, reason: result.ok ? 'fetched' : result.stderr };
}

export async function applyFetches(
	workspaceRoot: string,
	rows: GitJobRow[],
	concurrency = GIT_POOL,
): Promise<GitJobRow[]> {
	return mapPool(rows, concurrency, (row) => applyFetchAsync(workspaceRoot, row));
}

export async function planPull(loaded: LoadedManifest, onlyIds?: string[]): Promise<GitJobRow[]> {
	const only = onlyIds?.length ? new Set(onlyIds) : null;
	const listed = loaded.manifest.projects.filter((project) => !only || only.has(project.id));
	return mapPool(listed, GIT_POOL, async (project) => {
		const abs = joinRoot(loaded.workspaceRoot, project.path);
		if (!(await pathExists(abs))) {
			return { id: project.id, path: project.path, action: 'skip' as const, reason: 'missing' };
		}
		const git = await readGitAsync(abs);
		if (!git.repo) return { id: project.id, path: project.path, action: 'skip' as const, reason: 'no git' };
		if (git.dirty) return { id: project.id, path: project.path, action: 'skip' as const, reason: 'dirty' };
		if (git.busy) return { id: project.id, path: project.path, action: 'skip' as const, reason: git.busy };
		if (!git.origin) return { id: project.id, path: project.path, action: 'skip' as const, reason: 'no origin' };
		if (git.behind == null) return { id: project.id, path: project.path, action: 'skip' as const, reason: 'no upstream' };
		if (git.behind === 0) return { id: project.id, path: project.path, action: 'skip' as const, reason: 'not behind' };
		if ((git.ahead ?? 0) > 0) return { id: project.id, path: project.path, action: 'skip' as const, reason: 'diverged' };
		return { id: project.id, path: project.path, action: 'pull' as const };
	});
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

async function planPushOne(id: string, relPath: string, abs: string): Promise<GitJobRow> {
	const git = await readGitAsync(abs);
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
	const ids = onlyIds?.length ? onlyIds : loaded.manifest.projects.map((project) => project.id);
	return mapPool(ids, GIT_POOL, async (id) => {
		const project = loaded.manifest.projects.find((row) => row.id === id);
		if (!project) return { id, path: '', action: 'skip' as const, reason: 'not enrolled' };
		const abs = joinRoot(loaded.workspaceRoot, project.path);
		if (!(await pathExists(abs))) {
			return { id: project.id, path: project.path, action: 'skip' as const, reason: 'missing' };
		}
		return planPushOne(project.id, project.path, abs);
	});
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
