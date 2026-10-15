import { lstat, readFile, readdir, realpath } from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { readPkg, type PkgJson } from './pkg.js';
import { toPosix } from './paths.js';
import type { ReleaseTarget } from './releaseTypes.js';
import { runGit } from './git.js';

export const RELEASE_CONFIG = 'localhelm.release.json';

export async function releasePath(root: string, relative: string): Promise<string> {
	if (!relative.trim() || path.isAbsolute(relative) || /^[A-Za-z]:|^[\\/]/.test(relative)) throw new Error('Release paths must be relative to the enrolled checkout.');
	const target = path.resolve(root, relative.replace(/[\\/]/g, path.sep));
	if (relative.replaceAll('\\', '/').split('/').some((part) => part.toLowerCase() === '.git')) throw new Error('Release sources and output cannot be Git metadata.');
	const inside = (base: string, value: string): boolean => { const rel = path.relative(base, value); return !path.isAbsolute(rel) && rel !== '..' && !rel.startsWith(`..${path.sep}`); };
	if (!inside(path.resolve(root), target)) throw new Error(`Release path escapes the enrolled checkout: ${relative}`);
	let ancestor = target;
	while (true) {
		try { await lstat(ancestor); break; }
		catch (err) { if ((err as NodeJS.ErrnoException).code !== 'ENOENT') throw err; }
		const parent = path.dirname(ancestor);
		if (parent === ancestor) throw new Error(`Cannot resolve release path: ${relative}`);
		ancestor = parent;
	}
	if (!inside(await realpath(root), await realpath(ancestor))) throw new Error(`Release path resolves outside the enrolled checkout: ${relative}`);
	return toPosix(target);
}

export function releaseBins(pkg: PkgJson): Record<string, string> {
	if (pkg.bin === undefined) return {};
	if (typeof pkg.bin === 'string') {
		const name = pkg.name?.split('/').pop();
		if (!name || !pkg.bin.trim()) throw new Error('Executable entry requires a package name and file.');
		return { [name]: pkg.bin };
	}
	if (!pkg.bin || Array.isArray(pkg.bin) || typeof pkg.bin !== 'object') throw new Error('Invalid executable entries in the release manifest.');
	for (const [name, file] of Object.entries(pkg.bin)) if (!name.trim() || typeof file !== 'string' || !file.trim()) throw new Error('Executable entries must name a file.');
	return { ...pkg.bin };
}

export async function readReleaseTarget(root: string): Promise<{ target: ReleaseTarget; pkg: PkgJson } | null> {
	let config: Record<string, unknown> = {};
	const configFile = await releasePath(root, RELEASE_CONFIG);
	let configured = false;
	try {
		config = JSON.parse(await readFile(configFile, 'utf8')) as Record<string, unknown>;
		if (!config || Array.isArray(config) || typeof config !== 'object' || config.version !== 1) throw new Error('Expected release configuration version 1.');
		const allowed = new Set(['$schema', 'version', 'directory', 'manifest', 'readme', 'buildScript', 'kind', 'executables']);
		for (const key of Object.keys(config)) if (!allowed.has(key)) throw new Error(`Unknown release setting: ${key}`);
		configured = true;
	} catch (err) {
		if ((err as NodeJS.ErrnoException).code !== 'ENOENT') throw new Error(`${RELEASE_CONFIG}: ${(err as Error).message}`);
	}
	const string = (key: string, fallback?: string): string | undefined => {
		const value = config[key];
		if (value === undefined) return fallback;
		if (typeof value !== 'string' || !value.trim()) throw new Error(`Release ${key} must be a nonempty string.`);
		return value;
	};
	const directoryRel = string('directory', '.')!;
	const directory = await releasePath(root, directoryRel);
	const manifest = await releasePath(root, string('manifest', path.posix.join(directoryRel.replaceAll('\\', '/'), 'package.json'))!);
	let source: PkgJson | { error: string };
	try { await lstat(manifest); source = await readPkg(manifest); }
	catch (err) { if (!configured && (err as NodeJS.ErrnoException).code === 'ENOENT') return null; throw err; }
	if ('error' in source) throw new Error(source.error);
	const bins = releaseBins(source);
	const kind = config.kind ?? (Object.keys(bins).length ? 'cli' : 'package');
	if (kind !== 'cli' && kind !== 'package') throw new Error('Release kind must be package or cli.');
	const expected = config.executables ?? Object.keys(bins);
	if (!Array.isArray(expected) || expected.some((item) => typeof item !== 'string' || !item.trim()) || new Set(expected).size !== expected.length) throw new Error('Release executables must be unique names.');
	if (kind === 'cli' && !expected.length) throw new Error('CLI release needs declared executable entries or expected executable names.');
	const buildScript = string('buildScript');
	if (buildScript) {
		const harness = await readPkg(path.join(root, 'package.json'));
		if ('error' in harness || !harness.scripts?.[buildScript]) throw new Error(`Missing enrolled-root build script: ${buildScript}`);
	}
	let readme: string | undefined;
	if (config.readme !== undefined) {
		readme = await releasePath(root, string('readme')!);
		if (!(await lstat(readme)).isFile()) throw new Error('Release README source must be a file.');
	} else {
		try {
			const names = (await readdir(directory)).filter((name) => /^readme(?:\.[^/]+)?$/i.test(name)).sort();
			if (names[0]) readme = await releasePath(root, path.posix.join(directoryRel.replaceAll('\\', '/'), names[0]));
		} catch (err) { if ((err as NodeJS.ErrnoException).code !== 'ENOENT') throw err; }
	}
	const revision = createHash('sha256').update(JSON.stringify({ config, head: runGit(root, ['rev-parse', 'HEAD']).stdout.trim(), source: await readFile(manifest, 'utf8'), readme: readme ? (await readFile(readme)).toString('base64') : null, build: buildScript ? await readFile(path.join(root, 'package.json'), 'utf8') : null })).digest('hex');
	return { pkg: source, target: { directory, manifest, readme, buildScript, kind, executables: expected as string[], configured, revision } };
}
