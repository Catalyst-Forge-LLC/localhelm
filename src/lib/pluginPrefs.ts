import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { acquireJobLock } from './lock.js';
import path from 'node:path';
import { helmStateDir } from './demoMode.js';
import { toPosix } from './paths.js';

export const PLUGIN_PREFS_FILE = 'plugins.json';
const writes = new Map<string, Promise<unknown>>();

export type PluginPrefs = {
	version: 1;
	disabled: string[];
};

export function pluginPrefsPath(workspaceRoot: string): string {
	return toPosix(path.join(helmStateDir(workspaceRoot), PLUGIN_PREFS_FILE));
}

function emptyPrefs(): PluginPrefs {
	return { version: 1, disabled: [] };
}

function cleanIds(ids: unknown): string[] {
	if (!Array.isArray(ids)) return [];
	return [...new Set(ids.filter((id): id is string => typeof id === 'string' && Boolean(id.trim())))];
}

export async function readPluginPrefs(workspaceRoot: string, strict = true): Promise<PluginPrefs> {
	try {
		const raw = await readFile(pluginPrefsPath(workspaceRoot), 'utf8');
		const parsed = JSON.parse(raw) as { version?: unknown; disabled?: unknown };
		if (parsed.version !== 1 || !Array.isArray(parsed.disabled) || parsed.disabled.some((id) => typeof id !== 'string')) throw new Error('Invalid companion preferences.');
		return { version: 1, disabled: cleanIds(parsed.disabled) };
	} catch (err) {
		const code = err && typeof err === 'object' && 'code' in err ? String((err as { code: unknown }).code) : '';
		if (code !== 'ENOENT') {
			if (strict) throw new Error('Companion preferences are unreadable. Preserve the file before resetting them.');
		}
		return emptyPrefs();
	}
}

async function writePluginPrefs(workspaceRoot: string, prefs: PluginPrefs): Promise<PluginPrefs> {
	await mkdir(path.dirname(pluginPrefsPath(workspaceRoot)), { recursive: true });
	const payload: PluginPrefs = { version: 1, disabled: [...new Set(prefs.disabled)].sort() };
	const file = pluginPrefsPath(workspaceRoot); const temporary = `${file}.${randomUUID()}.tmp`;
	await writeFile(temporary, `${JSON.stringify(payload, null, 2)}\n`, { encoding: 'utf8', flag: 'wx' });
	await rename(temporary, file);
	return payload;
}

export function isPluginEnabled(id: string, prefs: PluginPrefs): boolean {
	return !prefs.disabled.includes(id);
}

export async function setPluginEnabled(
	workspaceRoot: string,
	id: string,
	enabled: boolean,
): Promise<PluginPrefs> {
	const key = id.trim();
	if (!key) return readPluginPrefs(workspaceRoot);
	const file = pluginPrefsPath(workspaceRoot);
	const previous = writes.get(file) ?? Promise.resolve();
	const task = previous.catch(() => undefined).then(async () => {
		const lock = await acquireJobLock(workspaceRoot);
		try {
			const current = await readPluginPrefs(workspaceRoot, true); const disabled = new Set(current.disabled);
			if (enabled) disabled.delete(key); else disabled.add(key);
			return await writePluginPrefs(workspaceRoot, { version: 1, disabled: [...disabled] });
		} finally { await lock.release(); }
	});
	writes.set(file, task);
	try { return await task; } finally { if (writes.get(file) === task) writes.delete(file); }
}
