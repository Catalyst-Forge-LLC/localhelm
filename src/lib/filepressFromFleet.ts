import { isDemoMode } from './demoMode.js';
import type { LoadedManifest } from './manifest.js';
import { loadPlugins } from './plugin.js';
import { isPluginEnabled, readPluginPrefs } from './pluginPrefs.js';

export type FilepressFromFleet = {
	added: string[];
	already: string[];
	error?: string;
};

function stringList(value: unknown): string[] {
	return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
}

/** After fleet enroll, ask FilePress to list sites under those folders. No-op if the plugin is off. */
export async function enrollFilepressFromFleet(
	loaded: LoadedManifest,
	absPaths: string[],
): Promise<FilepressFromFleet | undefined> {
	if (isDemoMode() || !absPaths.length) return undefined;
	try {
		const prefs = await readPluginPrefs(loaded.workspaceRoot);
		if (!isPluginEnabled('filepress', prefs)) return undefined;
		const plugins = await loadPlugins(loaded);
		const plug = plugins.find((row) => row.id === 'filepress');
		if (!plug?.plugin.apply) return undefined;
		const result = (await plug.plugin.apply('enroll-from', absPaths)) as {
			added?: unknown;
			already?: unknown;
		};
		return { added: stringList(result.added), already: stringList(result.already) };
	} catch (err) {
		return {
			added: [],
			already: [],
			error: err instanceof Error ? err.message : String(err),
		};
	}
}
