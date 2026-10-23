import { existsSync } from 'node:fs';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';

/** FilePress bridge reads this and does not start another site. In-flight ships finish. */
export function landStopPath(workspaceRoot: string): string {
	return path.join(workspaceRoot, '.localhelm', 'land.stop');
}

let landsRunning = 0;
let stopWanted = false;

export function landStopWanted(): boolean {
	return stopWanted;
}

export function landStopRequested(workspaceRoot: string): boolean {
	return stopWanted || existsSync(landStopPath(workspaceRoot));
}

export async function clearLandStop(workspaceRoot: string): Promise<void> {
	await rm(landStopPath(workspaceRoot), { force: true });
}

/** Call once at the start of an apply. A second overlapping apply must not wipe the first stop. */
export function beginLandStopScope(): void {
	if (landsRunning === 0) stopWanted = false;
	landsRunning += 1;
}

export async function finishLandStopScope(workspaceRoot: string): Promise<void> {
	landsRunning = Math.max(0, landsRunning - 1);
	if (landsRunning === 0) {
		stopWanted = false;
		await clearLandStop(workspaceRoot);
	}
}

export async function requestLandStop(workspaceRoot: string): Promise<void> {
	stopWanted = true;
	const file = landStopPath(workspaceRoot);
	await mkdir(path.dirname(file), { recursive: true });
	await writeFile(file, `${Date.now()}\n`, 'utf8');
}
