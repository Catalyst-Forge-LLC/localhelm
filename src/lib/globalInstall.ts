import { spawn, spawnSync } from 'node:child_process';
import type { LoadedManifest } from './manifest.js';
import { npmHasVersion, waitForNpmVersion, type WaitForNpmVersionOpts } from './npm.js';
import type { NpmCell } from './types.js';
import { joinRoot } from './paths.js';
import { pathExists, pkgBinNames, readPkg, rootPkgPath } from './pkg.js';
import { compareSemver } from './semver.js';
import { npmNotReadyReason } from './writeGate.js';

const TTL_MS = 2 * 60_000;
const INSTALL_MS = 180_000;

export type GlobalInstallRow = {
	id: string;
	path: string;
	npm?: string;
	version: string | null;
	action: 'global' | 'skip';
	reason?: string;
	have?: string | null;
	stdout?: string;
	stderr?: string;
};

export type GlobalInstallResult = { ok: boolean; stdout: string; stderr: string; missing?: boolean };
export type GlobalInstallRunner = (name: string, version: string) => Promise<GlobalInstallResult>;
export type GlobalInstallApplyOpts = {
	wait?: boolean;
	probe?: (name: string, version: string) => Promise<NpmCell>;
	waitOpts?: WaitForNpmVersionOpts;
};

let cached: { at: number; versions: Map<string, string> } | null = null;

export function clearGlobalCache(): void {
	cached = null;
}

export function requireGlobalIds(ids: string[]): string[] {
	const named = ids.map((id) => id.trim()).filter((id) => id.length > 0);
	if (named.length === 0) {
		throw new Error('name the project id(s) to install globally. LocalHelm will not install the whole fleet in one apply.');
	}
	return named;
}

export function parseGlobalVersions(raw: string): Map<string, string> {
	const out = new Map<string, string>();
	let parsed: unknown;
	try {
		parsed = JSON.parse(raw);
	} catch {
		return out;
	}
	const walk = (node: unknown): void => {
		if (!node || typeof node !== 'object') return;
		if (Array.isArray(node)) {
			for (const item of node) walk(item);
			return;
		}
		const deps = (node as { dependencies?: Record<string, { version?: string } | string> }).dependencies;
		if (!deps || typeof deps !== 'object') return;
		for (const [name, info] of Object.entries(deps)) {
			const version = typeof info === 'string' ? info : info?.version;
			if (name && version) out.set(name, version);
		}
	};
	walk(parsed);
	return out;
}

function listGlobalJson(bin: string, args: string[]): string | null {
	const win = process.platform === 'win32';
	const result = spawnSync(win && !bin.endsWith('.cmd') ? `${bin}.cmd` : bin, args, {
		encoding: 'utf8',
		windowsHide: true,
		shell: win,
		timeout: 20_000,
	});
	if (result.error || (result.status !== 0 && !result.stdout?.trim())) return null;
	return result.stdout ?? '';
}

export function readGlobalVersions(force = false): Map<string, string> {
	if (!force && cached && Date.now() - cached.at < TTL_MS) return cached.versions;
	const pnpm = listGlobalJson('pnpm', ['list', '-g', '--depth', '0', '--json']);
	const npm = pnpm ? null : listGlobalJson('npm', ['list', '-g', '--depth', '0', '--json']);
	const versions = parseGlobalVersions(pnpm ?? npm ?? '{}');
	cached = { at: Date.now(), versions };
	return versions;
}

export function isInstalledGlobalReason(reason: string | undefined): boolean {
	return Boolean(reason?.startsWith('installed global '));
}

function looksMissingBin(stderr: string, stdout: string): boolean {
	return /not recognized|ENOENT|command not found/i.test(`${stderr}\n${stdout}`);
}

function spawnGlobalAdd(bin: 'pnpm' | 'npm', spec: string): Promise<GlobalInstallResult> {
	const win = process.platform === 'win32';
	const exe = win ? `${bin}.cmd` : bin;
	const args = bin === 'pnpm' ? ['add', '-g', spec] : ['install', '-g', spec];
	return new Promise((resolve) => {
		const child = spawn(exe, args, {
			stdio: ['ignore', 'pipe', 'pipe'],
			windowsHide: true,
			shell: win,
		});
		let stdout = '';
		let stderr = '';
		let settled = false;
		const finish = (result: GlobalInstallResult): void => {
			if (settled) return;
			settled = true;
			clearTimeout(timer);
			resolve(result);
		};
		const timer = setTimeout(() => {
			child.kill();
			finish({ ok: false, stdout, stderr: stderr || `${bin} add -g timed out` });
		}, INSTALL_MS);
		child.stdout.on('data', (chunk: Buffer) => {
			stdout += String(chunk);
		});
		child.stderr.on('data', (chunk: Buffer) => {
			stderr += String(chunk);
		});
		child.on('error', (err) => {
			const missing = err && typeof err === 'object' && 'code' in err && (err as { code?: string }).code === 'ENOENT';
			finish({ ok: false, stdout, stderr: err.message, missing: missing || looksMissingBin(err.message, '') });
		});
		child.on('close', (status) => {
			const missing = status !== 0 && looksMissingBin(stderr, stdout);
			finish({ ok: status === 0, stdout, stderr, missing });
		});
	});
}

export function defaultGlobalInstallRunner(name: string, version: string): Promise<GlobalInstallResult> {
	if (name.startsWith('-') || version.startsWith('-')) {
		return Promise.resolve({ ok: false, stdout: '', stderr: 'refusing a flag-looking package name or version' });
	}
	const spec = `${name}@${version}`;
	return spawnGlobalAdd('pnpm', spec).then((pnpm) => {
		if (pnpm.ok || !pnpm.missing) return pnpm;
		return spawnGlobalAdd('npm', spec).then((npm) => {
			if (!npm.ok && npm.missing) {
				return { ok: false, stdout: '', stderr: 'pnpm and npm are missing; cannot install globally' };
			}
			return npm;
		});
	});
}

async function planOne(
	loaded: LoadedManifest,
	id: string,
	globals: Map<string, string>,
	wantVersion?: string,
): Promise<GlobalInstallRow> {
	const project = loaded.manifest.projects.find((row) => row.id === id);
	if (!project) return { id, path: '', version: null, action: 'skip', reason: 'not enrolled' };
	const abs = joinRoot(loaded.workspaceRoot, project.path);
	if (!(await pathExists(abs))) {
		return { id, path: project.path, version: null, action: 'skip', reason: 'folder missing' };
	}
	const rootRead = (await pathExists(rootPkgPath(abs))) ? await readPkg(rootPkgPath(abs)) : null;
	const pkg = rootRead && !('error' in rootRead) ? rootRead : undefined;
	if (pkg?.private) return { id, path: project.path, version: pkg.version ?? null, action: 'skip', reason: 'private' };
	const name = project.npm ?? pkg?.name;
	const bins = pkgBinNames(pkg);
	if (!name) return { id, path: project.path, version: pkg?.version ?? null, action: 'skip', reason: 'no npm package name' };
	if (!bins.length) return { id, path: project.path, npm: name, version: pkg?.version ?? null, action: 'skip', reason: 'no bin (not a CLI)' };
	const version = wantVersion ?? pkg?.version ?? null;
	if (!version) return { id, path: project.path, npm: name, version: null, action: 'skip', reason: 'no local version' };
	const have = globals.get(name) ?? null;
	if (have === version) {
		return { id, path: project.path, npm: name, version, action: 'skip', reason: `already global ${have}`, have };
	}
	const cmp = have ? compareSemver(have, version) : null;
	const verb = have ? 'update' : 'install';
	return {
		id,
		path: project.path,
		npm: name,
		version,
		action: 'global',
		have,
		reason: `${verb} ${name}@${version}${have ? ` (have ${have}${cmp !== null && cmp > 0 ? ', newer than local' : ''})` : ''}`,
	};
}

export async function planGlobalInstall(
	loaded: LoadedManifest,
	ids?: string[],
	globals?: Map<string, string>,
	versions?: Record<string, string>,
): Promise<GlobalInstallRow[]> {
	const have = globals ?? readGlobalVersions();
	const named = ids?.length ? requireGlobalIds(ids) : loaded.manifest.projects.map((row) => row.id);
	const rows: GlobalInstallRow[] = [];
	for (const id of named) rows.push(await planOne(loaded, id, have, versions?.[id]));
	return rows;
}

export async function applyGlobalInstall(
	row: GlobalInstallRow,
	runner: GlobalInstallRunner = defaultGlobalInstallRunner,
	opts: GlobalInstallApplyOpts = {},
): Promise<GlobalInstallRow> {
	if (row.action !== 'global' || !row.npm || !row.version) return row;
	const probe = opts.probe ?? npmHasVersion;
	let cell = await probe(row.npm, row.version);
	if (cell.status !== 'ok' && opts.wait) {
		cell = await waitForNpmVersion(row.npm, row.version, { ...opts.waitOpts, probe });
	}
	if (cell.status !== 'ok') {
		const reason =
			cell.status === 'none' ? npmNotReadyReason(row.npm, row.version) : (cell.error ?? 'npm lookup failed');
		return { ...row, reason, stderr: cell.error };
	}
	const result = await runner(row.npm, row.version);
	clearGlobalCache();
	if (!result.ok) {
		const err = (result.stderr || result.stdout || 'pnpm add -g failed').trim().split(/\r?\n/).find(Boolean);
		return { ...row, reason: err ?? 'pnpm add -g failed', stdout: result.stdout, stderr: result.stderr };
	}
	return {
		...row,
		reason: `installed global ${row.npm}@${row.version}`,
		have: row.version,
		stdout: result.stdout,
		stderr: result.stderr,
	};
}
