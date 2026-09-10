import { spawn } from 'node:child_process';
import path from 'node:path';
import type { LoadedManifest } from './manifest.js';
import { joinRoot, toPosix } from './paths.js';
import { pathExists, readPkg, rootPkgPath, shipScriptTarget, sitePkgPath, type ShipDir } from './pkg.js';
import { plainPluginError } from './writeGate.js';

export const SCRIPT_SHIP_TIMEOUT_MS = 600_000;

export type ScriptShipRow = {
	id: string;
	path: string;
	action: 'ship' | 'skip';
	reason?: string;
	dir?: ShipDir;
	cwd?: string;
	stdout?: string;
	stderr?: string;
};

export type ScriptShipResult = { ok: boolean; stdout: string; stderr: string };
export type ScriptShipRunner = (cwd: string) => Promise<ScriptShipResult>;

export function requireShipIds(ids: string[]): string[] {
	const named = ids.map((id) => id.trim()).filter((id) => id.length > 0);
	if (named.length === 0) {
		throw new Error('name the project id(s) to ship. LocalHelm will not ship the whole fleet in one apply.');
	}
	return named;
}

export function isShippedReason(reason: string | undefined): boolean {
	return Boolean(reason?.startsWith('shipped '));
}

export function defaultScriptShipRunner(cwd: string): Promise<ScriptShipResult> {
	const win = process.platform === 'win32';
	const pnpm = win ? 'pnpm.cmd' : 'pnpm';
	return new Promise((resolve) => {
		const child = spawn(pnpm, ['run', 'ship'], {
			cwd,
			stdio: ['ignore', 'pipe', 'pipe'],
			windowsHide: true,
			shell: win,
		});
		let stdout = '';
		let stderr = '';
		let settled = false;
		const finish = (result: ScriptShipResult): void => {
			if (settled) return;
			settled = true;
			clearTimeout(timer);
			resolve(result);
		};
		const timer = setTimeout(() => {
			child.kill();
			finish({ ok: false, stdout, stderr: stderr || 'pnpm ship timed out' });
		}, SCRIPT_SHIP_TIMEOUT_MS);
		child.stdout.on('data', (chunk: Buffer) => {
			stdout += String(chunk);
		});
		child.stderr.on('data', (chunk: Buffer) => {
			stderr += String(chunk);
		});
		child.on('error', (err) => {
			finish({ ok: false, stdout, stderr: err.message });
		});
		child.on('close', (status) => {
			finish({ ok: status === 0, stdout, stderr });
		});
	});
}

async function planOne(loaded: LoadedManifest, id: string, relPath: string): Promise<ScriptShipRow> {
	const abs = joinRoot(loaded.workspaceRoot, relPath);
	if (!(await pathExists(abs))) {
		return { id, path: relPath, action: 'skip', reason: 'folder missing' };
	}
	const rootRead = (await pathExists(rootPkgPath(abs))) ? await readPkg(rootPkgPath(abs)) : null;
	const rootPkg = rootRead && !('error' in rootRead) ? rootRead : undefined;
	const siteRead = (await pathExists(sitePkgPath(abs))) ? await readPkg(sitePkgPath(abs)) : null;
	const sitePkg = siteRead && !('error' in siteRead) ? siteRead : undefined;
	const target = shipScriptTarget(rootPkg, sitePkg);
	if (!target) {
		return { id, path: relPath, action: 'skip', reason: 'no scripts.ship' };
	}
	const cwd = target.dir === 'site' ? toPosix(path.join(abs, 'site')) : toPosix(abs);
	return { id, path: relPath, action: 'ship', dir: target.dir, cwd };
}

export async function planScriptShip(loaded: LoadedManifest, onlyIds?: string[]): Promise<ScriptShipRow[]> {
	const only = onlyIds?.length ? new Set(onlyIds) : null;
	const rows: ScriptShipRow[] = [];
	for (const project of loaded.manifest.projects) {
		if (only && !only.has(project.id)) continue;
		rows.push(await planOne(loaded, project.id, project.path));
	}
	if (only) {
		for (const id of only) {
			if (!rows.some((row) => row.id === id)) {
				rows.push({ id, path: '', action: 'skip', reason: 'not enrolled' });
			}
		}
	}
	return rows;
}

export async function applyScriptShip(
	_loaded: LoadedManifest,
	row: ScriptShipRow,
	runner: ScriptShipRunner = defaultScriptShipRunner,
): Promise<ScriptShipRow> {
	if (row.action !== 'ship' || !row.cwd) return row;
	const result = await runner(row.cwd);
	if (result.ok) {
		return {
			...row,
			reason: `shipped (${row.dir ?? 'root'})`,
			stdout: result.stdout,
			stderr: result.stderr,
		};
	}
	const raw = [result.stderr, result.stdout].filter(Boolean).join('\n');
	return {
		...row,
		reason: plainPluginError(raw) || 'pnpm ship failed',
		stdout: result.stdout,
		stderr: result.stderr,
	};
}
