import { hostname as osHostname, networkInterfaces } from 'node:os';
import { visitorTilesFromBoards, type VisitorSnapshot } from './visitorTiles.js';
import type { PluginBoard } from './plugin.js';

const SKIP_IFACE = /vethernet|hyper-?v|docker|wsl|loopback|bluetooth|vmware|virtualbox|vbox/i;

/** Server only — hostname and NIC list. Do not import this from a .svelte file. */
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
