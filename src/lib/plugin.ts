import { stat } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import type { LoadedManifest } from './manifest.js';
import { joinRoot, toPosix } from './paths.js';
import { pathExists } from './pkg.js';
import { isPluginEnabled, readPluginPrefs } from './pluginPrefs.js';

export const PLUGIN_FILE_NAMES = ['localhelm.plugin.mjs', 'localhelm.plugin.js'] as const;

export type PluginAction = {
	id: string;
	label: string;
	write: boolean;
	/** Optional Lucide id, e.g. `lucide:play`. LocalHelm falls back by action id if omitted. */
	icon?: string;
};

export type PluginTab = 'sites' | 'ports';

export type PluginRow = {
	id: string;
	label?: string;
	href?: string;
	/** Column id → http(s) URL. Helm turns that cell into a link and keeps the cell text. */
	links?: Record<string, string>;
	/** Several labels in one column (skills, tools). Each name is its own link when href is set. */
	linkGroups?: Record<string, { label: string; href?: string }[]>;
	cells: Record<string, string>;
	actions: PluginAction[];
};

export type PluginBoard = {
	plugin: string;
	title: string;
	note?: string;
	tab?: PluginTab;
	rowLabel?: string;
	columns: { id: string; label: string }[];
	rows: PluginRow[];
};

export type HelmPlugin = {
	id: string;
	label: string;
	board: () => Promise<PluginBoard | PluginBoard[]>;
	plan?: (action: string, ids: string[]) => Promise<unknown>;
	apply?: (action: string, ids: string[]) => Promise<unknown>;
};

export function asPluginBoards(raw: PluginBoard | PluginBoard[]): PluginBoard[] {
	return Array.isArray(raw) ? raw : [raw];
}

export function pluginTab(board: PluginBoard): PluginTab {
	return board.tab === 'ports' ? 'ports' : 'sites';
}

export type LoadedPlugin = {
	id: string;
	label: string;
	source: string;
	plugin: HelmPlugin;
};

function isPlugin(value: unknown): value is HelmPlugin {
	if (!value || typeof value !== 'object') return false;
	const body = value as Record<string, unknown>;
	return typeof body.id === 'string' && typeof body.label === 'string' && typeof body.board === 'function';
}

export async function loadPluginFile(file: string): Promise<HelmPlugin> {
	const stamp = (await stat(file)).mtimeMs;
	const href = `${pathToFileURL(file).href}?t=${stamp}`;
	const mod = (await import(/* @vite-ignore */ href)) as { default?: unknown };
	const candidate = mod.default ?? mod;
	if (!isPlugin(candidate)) {
		throw new Error(`${file} does not export a LocalHelm plugin (id, label, board)`);
	}
	return candidate;
}

export async function loadPlugins(loaded: LoadedManifest): Promise<LoadedPlugin[]> {
	const found: LoadedPlugin[] = [];
	for (const project of loaded.manifest.projects) {
		const abs = joinRoot(loaded.workspaceRoot, project.path);
		for (const name of PLUGIN_FILE_NAMES) {
			const file = toPosix(path.join(abs, name));
			if (!(await pathExists(file))) continue;
			const plugin = await loadPluginFile(file);
			found.push({ id: plugin.id, label: plugin.label, source: file, plugin });
			break;
		}
	}
	return found;
}

export function requirePlugin(plugins: LoadedPlugin[], id: string): LoadedPlugin {
	const hit = plugins.find((p) => p.id === id);
	if (!hit) {
		const have = plugins.map((p) => p.id).join(', ') || 'none';
		throw new Error(`plugin not loaded: ${id} (found ${have}). Enroll the project that has localhelm.plugin.mjs.`);
	}
	return hit;
}

export type PluginListing = {
	id: string;
	label: string;
	source: string;
	enabled: boolean;
};

export async function loadPluginDashboard(loaded: LoadedManifest): Promise<{
	plugins: PluginListing[];
	boards: PluginBoard[];
}> {
	const found = await loadPlugins(loaded);
	const prefs = await readPluginPrefs(loaded.workspaceRoot);
	const plugins = found.map((plug) => ({
		id: plug.id,
		label: plug.label,
		source: plug.source,
		enabled: isPluginEnabled(plug.id, prefs),
	}));
	const boards: PluginBoard[] = [];
	for (const plug of found) {
		if (!isPluginEnabled(plug.id, prefs)) continue;
		boards.push(...asPluginBoards(await plug.plugin.board()));
	}
	return { plugins, boards };
}
