import path from 'node:path';
import { runGit } from './git.js';
import { toPosix } from './paths.js';

export function helmRetargetMessage(pkg: string, version: string): string {
	return `Helm: retarget ${pkg} to ${version}.`;
}

export function helmBumpMessage(pkg: string, version: string): string {
	return `Helm: bump ${pkg} to ${version}.`;
}

/** True when git would refuse `git add` for this path (exit 0 from check-ignore). */
export function isGitIgnored(repoRoot: string, file: string): boolean {
	const rel = path.isAbsolute(file)
		? toPosix(path.relative(repoRoot, file)).replace(/^\.\//, '')
		: toPosix(file).replace(/^\.\//, '');
	if (!rel || rel.startsWith('..')) return false;
	return runGit(repoRoot, ['check-ignore', '-q', '--', rel]).ok;
}

export function commitPaths(
	repoRoot: string,
	files: string[],
	message: string,
): { ok: boolean; error?: string } {
	const mapped = files.map((file) => toPosix(path.relative(repoRoot, file)).replace(/^\.\//, ''));
	if (mapped.some((rel) => rel.startsWith('..'))) {
		return { ok: false, error: 'commit path is outside the repo' };
	}
	const rels = mapped.filter((rel) => rel.length > 0 && !isGitIgnored(repoRoot, rel));
	if (files.length && !rels.length) {
		return { ok: false, error: 'every commit path is gitignored' };
	}
	if (!rels.length) return { ok: false, error: 'nothing to commit' };
	const added = runGit(repoRoot, ['add', '--', ...rels]);
	if (!added.ok) return { ok: false, error: added.stderr };
	const committed = runGit(repoRoot, ['commit', '-m', message, '--', ...rels]);
	if (!committed.ok) return { ok: false, error: committed.stderr };
	return { ok: true };
}
