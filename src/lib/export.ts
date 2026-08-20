import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { LoadedManifest } from './manifest.js';
import { toPosix } from './paths.js';
import { fleetStatus } from './status.js';
import type { FleetInventory } from './types.js';

export type ExportPlan = {
	file: string;
	action: 'write' | 'skip';
	reason?: string;
};

export function defaultExportPath(workspaceRoot: string): string {
	return toPosix(path.join(workspaceRoot, 'localhelm.status.json'));
}

export function planExport(workspaceRoot: string, file?: string): ExportPlan {
	return { file: toPosix(file ?? defaultExportPath(workspaceRoot)), action: 'write' };
}

export async function applyExport(loaded: LoadedManifest, plan: ExportPlan): Promise<FleetInventory> {
	const inventory = await fleetStatus(loaded);
	await mkdir(path.dirname(plan.file), { recursive: true });
	await writeFile(plan.file, `${JSON.stringify(inventory, null, 2)}\n`, 'utf8');
	return inventory;
}
