/** Tile helpers. Safe for the dashboard client — hostname/NICs live in visitorMachine.ts. */
import { bindIsLan } from './portFilters.js';
import { visitorHttpUrl } from './loopback.js';
import type { PluginBoard } from './plugin.js';

const SKIP_IDS = new Set(['localhelm', 'localslip', 'localberth']);

export type VisitorTile = {
	name: string;
	port: number;
	title: string;
};

export type VisitorSnapshot = {
	hostname: string;
	addresses: string[];
	tiles: VisitorTile[];
};

export function isVisitorSelf(id: string, port: number, helmPort?: number): boolean {
	if (SKIP_IDS.has(id)) return true;
	if (port === 4321 || port === 54321) return true;
	if (helmPort && port === helmPort) return true;
	return false;
}

/** Named lease that is listening past loopback — it belongs on the Deck. */
export function isVisitorLeaseRow(row: {
	id: string;
	cells: Record<string, string>;
}): { port: number } | null {
	if (row.cells.listening !== 'yes') return null;
	if (row.cells.parked === 'yes') return null;
	if (!bindIsLan(row.cells.bind ?? '')) return null;
	const port = Number(row.cells.port);
	if (!Number.isInteger(port) || port < 1 || port > 65535) return null;
	return { port };
}

export function visitorTilesFromBoards(
	boards: readonly PluginBoard[],
	opts: { helmPort?: number } = {},
): VisitorTile[] {
	const leaseBoard = boards.find((board) => board.tab === 'ports' && board.title === 'Leases');
	const tiles: VisitorTile[] = [];
	for (const row of leaseBoard?.rows ?? []) {
		const hit = isVisitorLeaseRow(row);
		if (!hit) continue;
		if (isVisitorSelf(row.id, hit.port, opts.helmPort)) continue;
		tiles.push({
			name: row.id,
			port: hit.port,
			title: (row.label ?? row.id).trim() || row.id,
		});
	}
	return tiles;
}

export function visitorOpenHref(pageHost: string | null, port: number): string | null {
	return pageHost ? visitorHttpUrl(pageHost, port) : null;
}
