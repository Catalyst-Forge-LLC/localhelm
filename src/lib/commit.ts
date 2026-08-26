import path from 'node:path';
import { runGit } from './git.js';
import { toPosix } from './paths.js';

export function helmRetargetMessage(pkg: string, version: string): string {
	return `Helm: retarget ${pkg} to ${version}.`;
}

export function helmBumpMessage(pkg: string, version: string): string {
	return `Helm: bump ${pkg} to ${version}.`;
}

export function commitPaths(
	repoRoot: string,
	files: string[],
	message: string,
): { ok: boolean; error?: string } {
	const rels = files.map((file) => toPosix(path.relative(repoRoot, file)).replace(/^\.\//, ''));
	if (rels.some((rel) => rel.startsWith('..'))) {
		return { ok: false, error: 'commit path is outside the repo' };
	}
	const added = runGit(repoRoot, ['add', '--', ...rels]);
	if (!added.ok) return { ok: false, error: added.stderr };
	const committed = runGit(repoRoot, ['commit', '-m', message, '--', ...rels]);
	if (!committed.ok) return { ok: false, error: committed.stderr };
	return { ok: true };
}
