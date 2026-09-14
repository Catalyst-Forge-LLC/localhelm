import { landBatchSnap, type LandBatchRow } from '../../../src/lib/landDisplay.js';

const KEY = 'localhelm.landBatch';

export type LandBatchSnap = {
	ids: string[];
	rows: LandBatchRow[];
	remaining: string[];
	error?: string;
	done: boolean;
};

export function saveLandBatch(snap: LandBatchSnap): void {
	try {
		sessionStorage.setItem(KEY, JSON.stringify(snap));
	} catch {
		/* quota / private mode */
	}
}

export function loadLandBatch(): LandBatchSnap | null {
	try {
		const raw = sessionStorage.getItem(KEY);
		if (!raw) return null;
		const snap = JSON.parse(raw) as LandBatchSnap;
		if (!snap || !Array.isArray(snap.ids) || !Array.isArray(snap.rows)) return null;
		return snap;
	} catch {
		return null;
	}
}

export function clearLandBatch(): void {
	try {
		sessionStorage.removeItem(KEY);
	} catch {
		/* ignore */
	}
}

export function persistLandSnap(
	ids: string[],
	rows: LandBatchRow[],
	opts?: { done?: boolean; error?: string },
): LandBatchSnap {
	const snap = landBatchSnap(ids, rows, opts);
	saveLandBatch(snap);
	return snap;
}

export type { LandBatchRow };
