import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { toPosix } from './paths.js';

const LAND_SHIPS_FILE = 'land-ships.json';

export type LandShipRecord = {
	fingerprint: string;
	at: string;
};

type LandShipsFile = {
	version: 1;
	sites: Record<string, LandShipRecord>;
};

export function landShipsPath(workspaceRoot: string): string {
	return toPosix(path.join(workspaceRoot, '.localhelm', LAND_SHIPS_FILE));
}

async function readFileSafe(workspaceRoot: string): Promise<LandShipsFile> {
	try {
		const raw = await readFile(landShipsPath(workspaceRoot), 'utf8');
		const parsed = JSON.parse(raw) as { sites?: unknown };
		if (!parsed || typeof parsed !== 'object' || !parsed.sites || typeof parsed.sites !== 'object') {
			return { version: 1, sites: {} };
		}
		const sites: Record<string, LandShipRecord> = {};
		for (const [id, row] of Object.entries(parsed.sites as Record<string, unknown>)) {
			if (!row || typeof row !== 'object') continue;
			const body = row as { fingerprint?: unknown; at?: unknown };
			if (typeof body.fingerprint !== 'string' || !body.fingerprint.trim()) continue;
			sites[id] = {
				fingerprint: body.fingerprint,
				at: typeof body.at === 'string' && body.at.trim() ? body.at : new Date(0).toISOString(),
			};
		}
		return { version: 1, sites };
	} catch (err) {
		const code = err && typeof err === 'object' && 'code' in err ? String((err as { code: unknown }).code) : '';
		if (code === 'ENOENT') return { version: 1, sites: {} };
		return { version: 1, sites: {} };
	}
}

export async function readLandShipFingerprint(
	workspaceRoot: string,
	siteId: string,
): Promise<string | null> {
	const file = await readFileSafe(workspaceRoot);
	return file.sites[siteId]?.fingerprint ?? null;
}

export async function recordLandShip(
	workspaceRoot: string,
	siteId: string,
	fingerprint: string,
): Promise<void> {
	const named = siteId.trim();
	const fp = fingerprint.trim();
	if (!named || !fp) return;
	const file = await readFileSafe(workspaceRoot);
	file.sites[named] = { fingerprint: fp, at: new Date().toISOString() };
	const out = landShipsPath(workspaceRoot);
	await mkdir(path.dirname(out), { recursive: true });
	await writeFile(out, `${JSON.stringify(file, null, 2)}\n`, 'utf8');
}

/** Skip ship when the tree fingerprint matches the last successful Land/ship. */
export function shipUnchanged(last: string | null | undefined, current: string | null | undefined): boolean {
	if (!last || !current) return false;
	return last === current;
}
