import { hostname as osHostname, networkInterfaces } from 'node:os';
import { bindIsLan } from './portFilters.js';
import { visitorHttpUrl } from './loopback.js';
import type { PluginBoard } from './plugin.js';

const SKIP_IDS = new Set(['localhelm', 'localslip', 'localberth']);
const SKIP_IFACE = /vethernet|hyper-?v|docker|wsl|loopback|bluetooth|vmware|virtualbox|vbox/i;

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

/** Named lease that is listening past loopback — the phone can reach it. */
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

export function visitorMachineCard(): { hostname: string; addresses: string[] } {
	const found: string[] = [];
	for (const [name, addrs] of Object.entries(networkInterfaces())) {
		if (SKIP_IFACE.test(name)) continue;
		for (const row of addrs ?? []) {
			if (row.internal) continue;
			const family = String(row.family);
			if (family !== 'IPv4' && family !== '4') continue;
			if (row.address.startsWith('127.') || row.address.startsWith('169.254.')) continue;
			found.push(row.address);
		}
	}
	return { hostname: osHostname(), addresses: [...new Set(found)].slice(0, 4) };
}

export function visitorSnapshotFromBoards(
	boards: readonly PluginBoard[],
	opts: { helmPort?: number } = {},
): VisitorSnapshot {
	const machine = visitorMachineCard();
	return {
		hostname: machine.hostname,
		addresses: machine.addresses,
		tiles: visitorTilesFromBoards(boards, opts),
	};
}
