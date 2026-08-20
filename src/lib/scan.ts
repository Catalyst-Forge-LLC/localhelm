import { readdir, stat } from 'node:fs/promises';
import path from 'node:path';
import { isDir, pathExists, readPkg, rootPkgPath, sitePkgPath } from './pkg.js';
import { resolveUserPath, skipDirName, slugId, toPosix } from './paths.js';
import type { ScanCandidate } from './types.js';

export type ScanOptions = {
	roots: string[];
	maxDepth?: number;
	cwd?: string;
};

async function isGitRepo(dir: string): Promise<boolean> {
	try {
		const gitPath = path.join(dir, '.git');
		const info = await stat(gitPath);
		return info.isDirectory() || info.isFile();
	} catch {
		return false;
	}
}

async function candidateFor(dir: string, workspaceHint?: string): Promise<ScanCandidate | null> {
	const pkgFile = rootPkgPath(dir);
	const pkg = (await pathExists(pkgFile)) ? await readPkg(pkgFile) : null;
	const git = await isGitRepo(dir);
	if (!pkg && !git) return null;
	if (pkg && 'error' in pkg && !git) return null;
	const id = slugId(path.basename(dir));
	const site = await pathExists(sitePkgPath(dir));
	const rel = workspaceHint ? toPosix(path.relative(workspaceHint, dir)) || '.' : toPosix(dir);
	const row: ScanCandidate = {
		path: rel.replace(/\\/g, '/'),
		id,
		git,
		filepressSite: site,
	};
	if (pkg && !('error' in pkg)) {
		if (pkg.name) row.npmName = pkg.name;
		if (pkg.version) row.version = pkg.version;
		if (pkg.private) row.private = true;
	}
	return row;
}

async function walk(dir: string, depth: number, maxDepth: number, out: string[]): Promise<void> {
	if (depth > maxDepth) return;
	let entries;
	try {
		entries = await readdir(dir, { withFileTypes: true });
	} catch (err) {
		throw new Error(`cannot read ${dir}: ${err instanceof Error ? err.message : String(err)}`);
	}
	for (const entry of entries) {
		if (!entry.isDirectory()) continue;
		if (skipDirName(entry.name)) continue;
		const child = toPosix(path.join(dir, entry.name));
		out.push(child);
		await walk(child, depth + 1, maxDepth, out);
	}
}

export async function scanFolders(options: ScanOptions): Promise<ScanCandidate[]> {
	const cwd = options.cwd ?? process.cwd();
	const maxDepth = options.maxDepth ?? 3;
	const roots = options.roots.length > 0 ? options.roots : [cwd];
	const absRoots: string[] = [];
	for (const root of roots) {
		const abs = resolveUserPath(root, cwd);
		if (!(await isDir(abs))) {
			throw new Error(`scan root is not a directory: ${root} (${abs})`);
		}
		absRoots.push(abs);
	}
	const workspaceHint = absRoots.length === 1 ? absRoots[0] : undefined;
	const dirs = new Set<string>();
	for (const root of absRoots) {
		dirs.add(root);
		const nested: string[] = [];
		await walk(root, 0, maxDepth, nested);
		for (const d of nested) dirs.add(d);
	}
	const rows: ScanCandidate[] = [];
	const seen = new Set<string>();
	for (const dir of [...dirs].sort()) {
		const row = await candidateFor(dir, workspaceHint);
		if (!row) continue;
		const key = toPosix(path.resolve(workspaceHint ?? cwd, row.path));
		if (seen.has(key)) continue;
		seen.add(key);
		rows.push(row);
	}
	return rows;
}
