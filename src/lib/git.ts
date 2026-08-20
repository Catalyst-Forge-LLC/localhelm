import { spawnSync } from 'node:child_process';
import type { GitCell } from './types.js';

function git(cwd: string, args: string[]): { ok: boolean; stdout: string; stderr: string } {
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
	if (fetch) {
		const fetched = git(projectRoot, ['fetch', '--quiet', 'origin']);
		if (!fetched.ok && !/no such remote|does not exist/i.test(fetched.stderr)) {
			return {
				repo: true,
				dirty: false,
				staged: 0,
				unstaged: 0,
				untracked: 0,
				ahead: null,
				behind: null,
				error: `git fetch: ${fetched.stderr}`,
			};
		}
	}

	const status = git(projectRoot, ['status', '--porcelain=v1', '-b']);
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

	const remotes = git(projectRoot, ['remote', '-v']);
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
	const rebase = git(projectRoot, ['rev-parse', '--git-path', 'rebase-merge']);
	if (rebase.ok && rebase.stdout.trim() && rebase.stdout.trim() !== 'rebase-merge') {
		/* path exists check via another status token */
	}
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
	};
}
