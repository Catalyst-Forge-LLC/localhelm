/** Keep in sync with src/lib/pluginPlan.ts — no Node imports so the dashboard can bundle it. */
export function pluginPlanWriteIds(data: unknown): string[] | null {
	if (!data || typeof data !== 'object') return null;
	const rows = (data as { rows?: unknown }).rows;
	if (!Array.isArray(rows)) return null;
	const typed = rows.filter((row): row is Record<string, unknown> => Boolean(row) && typeof row === 'object');
	if (!typed.some((row) => typeof row.writes === 'boolean')) return null;
	return typed.filter((row) => row.writes === true && typeof row.id === 'string').map((row) => String(row.id));
}
