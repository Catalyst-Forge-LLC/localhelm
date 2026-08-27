import { familyRole, familyStem } from './family.js';

const HIDDEN_FILEPRESS_COLS = new Set(['pin', 'locked', 'update', 'headers', 'ship']);

export type BoardColumn = { id: string; label: string };

/** FilePress already sent pin / locked / update. Helm shows one engine version instead. */
export function siteTableColumns(plugin: string, columns: readonly BoardColumn[]): BoardColumn[] {
	if (plugin !== 'filepress') return [...columns];
	return [{ id: 'engine', label: 'engine' }, ...columns.filter((col) => !HIDDEN_FILEPRESS_COLS.has(col.id))];
}

export function siteEngineVersion(cells: Record<string, string>): string {
	const locked = (cells.locked ?? '').trim();
	if (locked && locked !== '—') return locked;
	const pin = (cells.pin ?? '').trim();
	return pin.replace(/^(npm|link|git)\s+/i, '') || '—';
}

export function siteSyncTarget(cells: Record<string, string>): string | null {
	const update = (cells.update ?? '').trim();
	const arrow = /→\s*([^\s,)]+)/.exec(update);
	if (arrow?.[1]) return arrow[1];
	return null;
}

export function siteNeedsEngineSync(cells: Record<string, string>): boolean {
	const update = (cells.update ?? '').trim().toLowerCase();
	const headers = (cells.headers ?? '').trim().toLowerCase();
	const updateStale = Boolean(update) && update !== '—' && !update.startsWith('already') && !update.startsWith('skip');
	return updateStale || headers.startsWith('merge');
}

export function siteSyncLabel(cells: Record<string, string>): string {
	const target = siteSyncTarget(cells);
	return target ? `Sync engine ${target}` : 'Sync engine';
}

export function siteCellValue(colId: string, cells: Record<string, string>): string {
	if (colId === 'engine') return siteEngineVersion(cells);
	return cells[colId] ?? '—';
}

/** FilePress `live` is a public URL or "—". Only http(s) becomes a link. */
export function siteLiveHref(cells: Record<string, string>): string | null {
	const raw = (cells.live ?? '').trim();
	if (!raw || raw === '—') return null;
	try {
		const url = new URL(raw);
		if (url.protocol === 'http:' || url.protocol === 'https:') return url.href;
	} catch {
		return null;
	}
	return null;
}

export type SiteLeaseRef = { id: string; href?: string };

/**
 * Local preview URL from the Ports board. FilePress names the repo folder (`localhelm`);
 * the lease is usually `*-site`. Never use the dashboard / UI lease.
 */
export function siteLocalHref(siteId: string, leases: readonly SiteLeaseRef[]): string | null {
	const stem = familyStem(siteId);
	if (!stem) return null;
	const hits = leases.filter((row) => row.href && familyStem(row.id) === stem);
	const siteRole = hits.find((row) => familyRole(row.id) === 'site');
	if (siteRole?.href) return siteRole.href;
	if (familyRole(siteId) !== 'site') return null;
	return hits.find((row) => row.id === siteId)?.href ?? null;
}
