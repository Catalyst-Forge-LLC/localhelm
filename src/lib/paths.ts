import { homedir } from 'node:os';
import path from 'node:path';

const MANIFEST_NAME = 'localhelm.fleet.json';

export function normalizePath(input: string): string {
	const next = input.replace(/\\/g, '/');
	if (/^[A-Za-z]:$/.test(next)) return `${next}/`;
	return next.replace(/\/+$/, '') || next;
}

export function toPosix(input: string): string {
	return normalizePath(input);
}

export function resolveUserPath(input: string, cwd = process.cwd()): string {
	const expanded = input.startsWith('~/') ? path.join(homedir(), input.slice(2)) : input;
	return toPosix(path.resolve(cwd, expanded));
}

export function relativeToRoot(absPath: string, workspaceRoot: string): string {
	const rel = path.posix.relative(toPosix(workspaceRoot), toPosix(absPath));
	if (rel.startsWith('..')) {
		throw new Error(`path is outside workspaceRoot: ${absPath}`);
	}
	return rel || '.';
}

export function joinRoot(workspaceRoot: string, rel: string): string {
	return toPosix(path.resolve(workspaceRoot, rel));
}

export function slugId(folderName: string): string {
	const slug = folderName
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-+|-+$/g, '');
	return slug || 'project';
}

export function userGlobalManifestPath(): string {
	return toPosix(path.join(homedir(), '.localhelm', 'fleet.json'));
}

export function manifestName(): string {
	return MANIFEST_NAME;
}

export function skipDirName(name: string): boolean {
	if (name === 'node_modules') return true;
	if (name.startsWith('.')) return true;
	if (name.startsWith('__')) return true;
	return false;
}
