import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { toPosix } from './paths.js';

export const PLUGIN_PREFS_FILE = 'plugins.json';

export type PluginPrefs = {
	version: 1;
	disabled: string[];
};

export function pluginPrefsPath(workspaceRoot: string): string {
	return toPosix(path.join(workspaceRoot, '.localhelm', PLUGIN_PREFS_FILE));
}

function emptyPrefs(): PluginPrefs {
	return { version: 1, disabled: [] };
}

function cleanIds(ids: unknown): string[] {
	if (!Array.isArray(ids)) return [];
	return [...new Set(ids.filter((id): id is string => typeof id === 'string' && Boolean(id.trim())))];
}

export async function readPluginPrefs(workspaceRoot: string): Promise<PluginPrefs> {
	try {
		const raw = await readFile(pluginPrefsPath(workspaceRoot), 'utf8');
		const parsed = JSON.parse(raw) as { disabled?: unknown };
		return { version: 1, disabled: cleanIds(parsed.disabled) };
	} catch (err) {
		const code = err && typeof err === 'object' && 'code' in err ? String((err as { code: unknown }).code) : '';
		if (code !== 'ENOENT') {
			/* fall through to defaults */
		}
		return emptyPrefs();
	}
}

async function writePluginPrefs(workspaceRoot: string, prefs: PluginPrefs): Promise<PluginPrefs> {
	await mkdir(path.dirname(pluginPrefsPath(workspaceRoot)), { recursive: true });
	const payload: PluginPrefs = { version: 1, disabled: [...new Set(prefs.disabled)].sort() };
	await writeFile(pluginPrefsPath(workspaceRoot), `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
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
	const current = await readPluginPrefs(workspaceRoot);
	const disabled = new Set(current.disabled);
	if (enabled) disabled.delete(key);
	else disabled.add(key);
	return writePluginPrefs(workspaceRoot, { version: 1, disabled: [...disabled] });
}
