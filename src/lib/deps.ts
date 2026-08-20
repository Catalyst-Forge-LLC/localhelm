import type { FleetInventory, PinEdge } from './types.js';

export type DepsView = {
	publishers: {
		id: string;
		npm?: string;
		npmLatest?: string;
		dependents: PinEdge[];
	}[];
	cycles: string[][];
};

export function fleetDeps(inventory: FleetInventory, onlyId?: string): DepsView {
	const byId = new Map(inventory.projects.map((row) => [row.id, row]));
	const publishers = inventory.projects
		.filter((row) => !onlyId || row.id === onlyId)
		.map((row) => {
			const dependents = inventory.projects.flatMap((other) =>
				other.pins.filter((pin) => pin.targetId === row.id),
			);
			return {
				id: row.id,
				npm: row.npm.name,
				npmLatest: row.npm.latest,
				dependents,
			};
		});

	const graph = new Map<string, string[]>();
	for (const row of inventory.projects) {
		graph.set(
			row.id,
			row.pins.map((pin) => pin.targetId).filter((id): id is string => Boolean(id)),
		);
	}
	return { publishers, cycles: findCycles(graph) };
}

function findCycles(graph: Map<string, string[]>): string[][] {
	const cycles: string[][] = [];
	const seen = new Set<string>();

	function walk(node: string, stack: string[]): void {
		if (stack.includes(node)) {
			const cycle = [...stack.slice(stack.indexOf(node)), node];
			const key = cycle.slice(0, -1).sort().join('>');
			if (!seen.has(key)) {
				seen.add(key);
				cycles.push(cycle);
			}
			return;
		}
		for (const next of graph.get(node) ?? []) walk(next, [...stack, node]);
	}

	for (const id of graph.keys()) walk(id, []);
	return cycles;
}
