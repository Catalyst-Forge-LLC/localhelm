/** First-party panes. Plugin tabs use the plugin id (`filepress`, `localslip`, …). */
export const CORE_TABS = ['today', 'fleet'] as const;
export type CoreTab = (typeof CORE_TABS)[number];

/** Old dashboard URLs. Sites was every non-port plugin; now each plugin has a tab. */
export const TAB_ALIASES: Record<string, string> = {
	sites: 'filepress',
	ports: 'localslip',
};

export type PluginTabMeta = {
	id: string;
	label: string;
};

const TAB_ID = /^[a-z][a-z0-9-]*$/;

export function canonicalizeTab(raw: string): string {
	return TAB_ALIASES[raw] ?? raw;
}

export function parseDashboardTab(raw: string | null): string | null {
	if (!raw) return null;
	if (raw === 'today' || raw === 'fleet') return raw;
	const id = canonicalizeTab(raw);
	return TAB_ID.test(id) ? id : null;
}

export function isCoreTab(tab: string): tab is CoreTab {
	return tab === 'today' || tab === 'fleet';
}

export function isPortsPluginTab(tab: string): boolean {
	return canonicalizeTab(tab) === 'localslip';
}

export function pluginTabMetas(
	plugins: ReadonlyArray<{ id: string; label: string }>,
	boards: ReadonlyArray<{ plugin: string; title: string }>,
): PluginTabMeta[] {
	if (plugins.length) {
		return plugins.map((plug) => ({ id: plug.id, label: plug.label.trim() || plug.id }));
	}
	const seen = new Map<string, PluginTabMeta>();
	for (const board of boards) {
		if (!board.plugin || seen.has(board.plugin)) continue;
		seen.set(board.plugin, { id: board.plugin, label: board.title.trim() || board.plugin });
	}
	return [...seen.values()];
}

export function pluginTabIcon(pluginId: string): string {
	if (pluginId === 'filepress') return 'lucide:globe';
	if (pluginId === 'localslip') return 'lucide:anchor';
	if (pluginId === 'xfacts') return 'lucide:tag';
	return 'lucide:puzzle';
}

export function pluginTabCount(
	pluginId: string,
	boards: ReadonlyArray<{ plugin: string; title?: string; rows: readonly unknown[] }>,
): number {
	const mine = boards.filter((board) => board.plugin === pluginId);
	if (pluginId === 'localslip') {
		const leases = mine.find((board) => board.title === 'Leases') ?? mine[0];
		return leases?.rows.length ?? 0;
	}
	return mine.reduce((sum, board) => sum + board.rows.length, 0);
}
