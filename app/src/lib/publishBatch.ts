const KEY = 'localhelm.publishBatch';

export type PublishBatchRow = {
	id: string;
	action: string;
	reason?: string;
	version?: string | null;
	npm?: string;
};

export type PublishBatchSnap = {
	ids: string[];
	rows: PublishBatchRow[];
	remaining: string[];
	githubPending: PublishBatchRow[];
	error?: string;
	done: boolean;
};

export function savePublishBatch(snap: PublishBatchSnap): void {
	try {
		sessionStorage.setItem(KEY, JSON.stringify(snap));
	} catch {
		/* quota / private mode */
	}
}

export function loadPublishBatch(): PublishBatchSnap | null {
	try {
		const raw = sessionStorage.getItem(KEY);
		if (!raw) return null;
		const snap = JSON.parse(raw) as PublishBatchSnap;
		if (!snap || !Array.isArray(snap.ids) || !Array.isArray(snap.rows)) return null;
		return snap;
	} catch {
		return null;
	}
}

export function clearPublishBatch(): void {
	try {
		sessionStorage.removeItem(KEY);
	} catch {
		/* ignore */
	}
}

export function remainingAfter(ids: string[], rows: ReadonlyArray<{ id: string }>): string[] {
	const done = new Set(rows.map((row) => row.id));
	return ids.filter((id) => !done.has(id));
}
