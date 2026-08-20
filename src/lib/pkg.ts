import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { toPosix } from './paths.js';

export type PkgJson = {
	name?: string;
	version?: string;
	private?: boolean;
	dependencies?: Record<string, string>;
	devDependencies?: Record<string, string>;
	peerDependencies?: Record<string, string>;
	optionalDependencies?: Record<string, string>;
};

export async function readPkg(filePath: string): Promise<PkgJson | { error: string }> {
	try {
		const raw = await readFile(filePath, 'utf8');
		const parsed: unknown = JSON.parse(raw);
		if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
			return { error: `not a package object: ${filePath}` };
		}
		return parsed as PkgJson;
	} catch (err) {
		const code = err && typeof err === 'object' && 'code' in err ? String((err as { code: unknown }).code) : '';
		if (code === 'ENOENT') return { error: `missing: ${filePath}` };
		return { error: err instanceof Error ? err.message : String(err) };
	}
}

export async function pathExists(target: string): Promise<boolean> {
	try {
		await stat(target);
		return true;
	} catch {
		return false;
	}
}

export async function isDir(target: string): Promise<boolean> {
	try {
		const info = await stat(target);
		return info.isDirectory();
	} catch {
		return false;
	}
}

export function sitePkgPath(projectRoot: string): string {
	return toPosix(path.join(projectRoot, 'site', 'package.json'));
}

export function rootPkgPath(projectRoot: string): string {
	return toPosix(path.join(projectRoot, 'package.json'));
}

export function collectDeps(pkg: PkgJson): Record<string, string> {
	return {
		...pkg.dependencies,
		...pkg.devDependencies,
		...pkg.peerDependencies,
		...pkg.optionalDependencies,
	};
}
