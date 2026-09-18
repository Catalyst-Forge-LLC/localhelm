import { familyRole, familyStem } from './family.js';

const HIDDEN_FILEPRESS_COLS = new Set(['pin', 'locked', 'update', 'headers', 'ship']);
const HIDDEN_FILEPRESS_JOBS = new Set(['sync', 'push']);
const HIDDEN_XFACTS_COLS = new Set(['name', 'status']);

export type BoardColumn = { id: string; label: string };

/** FilePress already sent pin / locked / update. Helm shows one engine version instead. */
/** Sync is a dedicated engine button. Push lives on Fleet, where origin/ahead already show. */
export function sitePluginJobVisible(plugin: string, actionId: string): boolean {
	if (plugin !== 'filepress') return true;
	return !HIDDEN_FILEPRESS_JOBS.has(actionId);
}

export function siteTableColumns(plugin: string, columns: readonly BoardColumn[]): BoardColumn[] {
	if (plugin === 'xfacts') return columns.filter((col) => !HIDDEN_XFACTS_COLS.has(col.id));
	if (plugin !== 'filepress') return [...columns];
	return [{ id: 'engine', label: 'engine' }, ...columns.filter((col) => !HIDDEN_FILEPRESS_COLS.has(col.id))];
}

/** Quiet row note. xFacts keeps "ok" off the table and only surfaces a problem. */
export function pluginRowNote(plugin: string, cells: Record<string, string>): string | null {
	if (plugin !== 'xfacts') return null;
	const status = (cells.status ?? '').trim();
	if (!status || status === 'ok' || status === '—') return null;
	return status;
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

function siteCanShip(cells: Record<string, string>): boolean {
	const ship = (cells.ship ?? '').trim().toLowerCase();
	return ship === 'yes' || ship.startsWith('pnpm');
}

function siteShipFingerprint(row: {
	cells: Record<string, string>;
	shipFingerprint?: string | null;
}): string | null {
	const fromRow = (row.shipFingerprint ?? '').trim();
	if (fromRow) return fromRow;
	const fromCell = (row.cells.shipFp ?? row.cells.shipFingerprint ?? '').trim();
	return fromCell || null;
}

/**
 * Same work Land would do: engine sync, a failed ship, or a shipable tree that
 * is not the last successful Land fingerprint. Pushing a companion after Land
 * changes HEAD, so this is true even when the engine pin is already current.
 */
export function siteNeedsLand(
	row: { cells: Record<string, string>; shipFingerprint?: string | null },
	lastShipFingerprint?: string | null,
	pending = false,
): boolean {
	if (siteNeedsEngineSync(row.cells) || pending) return true;
	if (!siteCanShip(row.cells)) return false;
	const current = siteShipFingerprint(row);
	if (!current) return false;
	const last = (lastShipFingerprint ?? '').trim();
	if (!last) return true;
	return last !== current;
}

export function siteLandReason(
	row: { cells: Record<string, string>; shipFingerprint?: string | null },
	lastShipFingerprint?: string | null,
	pendingReason?: string | null,
): string {
	const parts: string[] = [];
	const update = (row.cells.update ?? '').trim();
	const headers = (row.cells.headers ?? '').trim();
	const updateLc = update.toLowerCase();
	if (update && update !== '—' && !updateLc.startsWith('already') && !updateLc.startsWith('skip')) {
		parts.push(update);
	}
	if (headers.toLowerCase().startsWith('merge')) parts.push(headers);
	if (pendingReason?.trim()) parts.push(pendingReason.trim());
	else if (siteNeedsLand(row, lastShipFingerprint, false) && !siteNeedsEngineSync(row.cells)) {
		parts.push('Ship — tree changed since last Land');
	}
	return parts.join(' · ') || pendingReason || update || '—';
}

export function siteSyncLabel(cells: Record<string, string>): string {
	const target = siteSyncTarget(cells);
	return target ? `Sync engine ${target}` : 'Sync engine';
}

export function siteCellValue(colId: string, cells: Record<string, string>): string {
	if (colId === 'engine') return siteEngineVersion(cells);
	return cells[colId] ?? '—';
}

/** Only http(s) becomes a link. Cells may be a URL or contain one. */
export function pluginCellHref(raw: string | undefined | null): string | null {
	const text = (raw ?? '').trim();
	if (!text || text === '—') return null;
	const match = /https?:\/\/[^\s)\]>]+/.exec(text);
	const candidate = match?.[0] ?? text;
	try {
		const url = new URL(candidate);
		if (url.protocol === 'http:' || url.protocol === 'https:') return url.href;
	} catch {
		return null;
	}
	return null;
}

/** FilePress `live` is a public URL or "—". Only http(s) becomes a link. */
export function siteLiveHref(cells: Record<string, string>): string | null {
	return pluginCellHref(cells.live);
}

export function pluginRowOpenHref(row: {
	href?: string;
	links?: Record<string, string>;
	cells: Record<string, string>;
}): string | null {
	return pluginCellHref(row.href) ?? pluginCellHref(row.links?.app) ?? siteLiveHref(row.cells);
}

export type PluginCellLink = { label: string; href: string | null };

/** Named links for one column. A group wins over a single `links` URL. */
export function pluginCellLinks(
	row: {
		links?: Record<string, string>;
		linkGroups?: Record<string, { label: string; href?: string }[]>;
		cells: Record<string, string>;
	},
	colId: string,
	fallbackLabel: string,
): PluginCellLink[] {
	const group = row.linkGroups?.[colId];
	if (group?.length) {
		return group.map((item) => ({
			label: item.label.trim() || fallbackLabel,
			href: pluginCellHref(item.href),
		}));
	}
	const href = pluginCellHref(row.links?.[colId]) ?? pluginCellHref(row.cells[colId]);
	if (!href) return [];
	return [{ label: fallbackLabel, href }];
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
