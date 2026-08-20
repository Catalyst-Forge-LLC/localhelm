import { readFile } from 'node:fs/promises';
import path from 'node:path';
import ignore, { type Ignore } from 'ignore';
import { homedir } from 'node:os';
import { pathExists } from './pkg.js';
import { toPosix } from './paths.js';

export const IGNORE_FILE_NAME = '.localhelmignore';

export function userGlobalIgnorePath(): string {
	return toPosix(path.join(homedir(), '.localhelm', 'ignore'));
}

export function createScanIgnore(): Ignore {
	return ignore();
}

export async function loadIgnoreFile(filePath: string, ig: Ignore): Promise<boolean> {
	if (!(await pathExists(filePath))) return false;
	const text = await readFile(filePath, 'utf8');
	ig.add(text);
	return true;
}

export async function loadScanIgnore(scanRoot: string): Promise<Ignore> {
	const ig = createScanIgnore();
	await loadIgnoreFile(userGlobalIgnorePath(), ig);
	const files: string[] = [];
	let dir = toPosix(scanRoot);
	for (let i = 0; i < 8; i += 1) {
		files.push(toPosix(path.join(dir, IGNORE_FILE_NAME)));
		const parent = toPosix(path.dirname(dir));
		if (parent === dir) break;
		dir = parent;
	}
	for (const file of files.reverse()) {
		await loadIgnoreFile(file, ig);
	}
	return ig;
}

export function isIgnoredRel(ig: Ignore, relPosix: string): boolean {
	const rel = relPosix.replace(/\\/g, '/').replace(/^\/+/, '');
	if (!rel || rel === '.') return false;
	return ig.ignores(rel) || ig.ignores(`${rel}/`);
}
