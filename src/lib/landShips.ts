import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { helmStateDir } from './demoMode.js';
import { toPosix } from './paths.js';

const LAND_SHIPS_FILE = 'land-ships.json';

export type LandShipRecord = {
	/** Last successful ship fingerprint. Empty when a site has only a failed attempt. */
	fingerprint: string;
	at: string;
	/** Set when Land/ship failed. Cleared only after a successful ship. */
	pending?: boolean;
	lastError?: string;
	lastFailedFingerprint?: string;
};

export type LandShipsFile = {
	version: 1;
	sites: Record<string, LandShipRecord>;
};

export function landShipsPath(workspaceRoot: string): string {
	return toPosix(path.join(helmStateDir(workspaceRoot), LAND_SHIPS_FILE));
}

function parseRecord(row: unknown): LandShipRecord | null {
	if (!row || typeof row !== 'object') return null;
	const body = row as {
		fingerprint?: unknown;
		at?: unknown;
		pending?: unknown;
		lastError?: unknown;
		lastFailedFingerprint?: unknown;
	};
	const fingerprint = typeof body.fingerprint === 'string' ? body.fingerprint.trim() : '';
	const pending = body.pending === true;
	if (!fingerprint && !pending) return null;
	const lastError = typeof body.lastError === 'string' && body.lastError.trim() ? body.lastError.trim() : undefined;
	const lastFailedFingerprint =
		typeof body.lastFailedFingerprint === 'string' && body.lastFailedFingerprint.trim()
			? body.lastFailedFingerprint.trim()
			: undefined;
	return {
		fingerprint,
		at: typeof body.at === 'string' && body.at.trim() ? body.at : new Date(0).toISOString(),
		...(pending ? { pending: true } : {}),
		...(lastError ? { lastError: lastError.slice(0, 240) } : {}),
		...(lastFailedFingerprint ? { lastFailedFingerprint } : {}),
	};
}

export async function readLandShips(workspaceRoot: string): Promise<LandShipsFile> {
	try {
		const raw = await readFile(landShipsPath(workspaceRoot), 'utf8');
		const parsed = JSON.parse(raw) as { sites?: unknown };
		if (!parsed || typeof parsed !== 'object' || !parsed.sites || typeof parsed.sites !== 'object') {
			return { version: 1, sites: {} };
		}
		const sites: Record<string, LandShipRecord> = {};
		for (const [id, row] of Object.entries(parsed.sites as Record<string, unknown>)) {
			const rec = parseRecord(row);
			if (rec) sites[id] = rec;
		}
		return { version: 1, sites };
	} catch (err) {
		const code = err && typeof err === 'object' && 'code' in err ? String((err as { code: unknown }).code) : '';
		if (code === 'ENOENT') return { version: 1, sites: {} };
		return { version: 1, sites: {} };
	}
}

async function writeLandShips(workspaceRoot: string, file: LandShipsFile): Promise<void> {
	const out = landShipsPath(workspaceRoot);
	await mkdir(path.dirname(out), { recursive: true });
	await writeFile(out, `${JSON.stringify({ version: 1, sites: file.sites }, null, 2)}\n`, 'utf8');
}

export async function readLandShipRecord(
	workspaceRoot: string,
	siteId: string,
): Promise<LandShipRecord | null> {
	const file = await readLandShips(workspaceRoot);
	return file.sites[siteId] ?? null;
}

export async function readLandShipFingerprint(
	workspaceRoot: string,
	siteId: string,
): Promise<string | null> {
	const rec = await readLandShipRecord(workspaceRoot, siteId);
	const fp = rec?.fingerprint?.trim();
	return fp ? fp : null;
}

export async function readLandPendingSiteIds(workspaceRoot: string): Promise<string[]> {
	const file = await readLandShips(workspaceRoot);
	return Object.entries(file.sites)
		.filter(([, row]) => row.pending)
		.map(([id]) => id)
		.sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
}

/** Last successful ship fingerprint per site. Failed-only rows are omitted. */
export async function readLandShipFingerprints(workspaceRoot: string): Promise<Record<string, string>> {
	const file = await readLandShips(workspaceRoot);
	const out: Record<string, string> = {};
	for (const [id, row] of Object.entries(file.sites)) {
		const fp = row.fingerprint?.trim();
		if (fp) out[id] = fp;
	}
	return out;
}

export async function readLandPendingReasons(workspaceRoot: string): Promise<Record<string, string>> {
	const file = await readLandShips(workspaceRoot);
	const out: Record<string, string> = {};
	for (const [id, row] of Object.entries(file.sites)) {
		if (!row.pending) continue;
		out[id] = row.lastError || 'Ship failed — still needs Land';
	}
	return out;
}

export async function recordLandShip(
	workspaceRoot: string,
	siteId: string,
	fingerprint: string,
): Promise<void> {
	const named = siteId.trim();
	const fp = fingerprint.trim();
	if (!named || !fp) return;
	const file = await readLandShips(workspaceRoot);
	file.sites[named] = { fingerprint: fp, at: new Date().toISOString() };
	await writeLandShips(workspaceRoot, file);
}

/** Remember a failed ship without treating the tree as landed. */
export async function markLandShipFailed(
	workspaceRoot: string,
	siteId: string,
	fingerprint: string,
	reason: string,
): Promise<void> {
	const named = siteId.trim();
	if (!named) return;
	const file = await readLandShips(workspaceRoot);
	const existing = file.sites[named];
	const lastError = reason.trim().slice(0, 240);
	const failedFp = fingerprint.trim();
	file.sites[named] = {
		fingerprint: existing?.fingerprint ?? '',
		at: existing?.at ?? new Date(0).toISOString(),
		pending: true,
		...(lastError ? { lastError } : {}),
		...(failedFp ? { lastFailedFingerprint: failedFp } : existing?.lastFailedFingerprint
			? { lastFailedFingerprint: existing.lastFailedFingerprint }
			: {}),
	};
	await writeLandShips(workspaceRoot, file);
}

/** Skip ship when the tree fingerprint matches the last successful Land/ship. A pending failure never skips. */
export function shipUnchanged(
	last: string | null | undefined,
	current: string | null | undefined,
	pending = false,
): boolean {
	if (pending) return false;
	if (!last || !current) return false;
	return last === current;
}
