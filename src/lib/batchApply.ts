import { JobCancelledError, isJobCancelled } from './jobCancel.js';

export type NamedBatchFailure = { name: string; reason: string };

export type NamedBatchHooks = {
	shouldStop?: () => boolean;
	onStart?: (name: string, index: number, total: number) => void;
	onDone?: (name: string) => void;
	onFail?: (name: string, reason: string) => void;
};

/**
 * Run a named list in order. One item's throw does not skip the rest.
 * Stop still aborts before the next name. JobCancelledError always rethrows.
 */
export async function runNamedBatch(
	names: string[],
	fn: (name: string) => Promise<void>,
	hooks: NamedBatchHooks = {},
): Promise<NamedBatchFailure[]> {
	const failed: NamedBatchFailure[] = [];
	const list = names.filter(Boolean);
	for (let i = 0; i < list.length; i++) {
		const name = list[i]!;
		if (hooks.shouldStop?.()) throw new JobCancelledError(i, list.length);
		hooks.onStart?.(name, i, list.length);
		try {
			await fn(name);
			hooks.onDone?.(name);
		} catch (err) {
			if (isJobCancelled(err)) throw err;
			const reason = err instanceof Error ? err.message : String(err);
			failed.push({ name, reason });
			hooks.onFail?.(name, reason);
		}
	}
	return failed;
}

export function joinBatchFailures(failed: readonly NamedBatchFailure[]): string {
	return failed.map((row) => `${row.name}: ${row.reason}`).join(' · ');
}

/** Ids that do not yet have a result row (reload leftover / Land remaining). */
export function remainingAfter(ids: string[], rows: ReadonlyArray<{ id: string }>): string[] {
	const done = new Set(rows.map((row) => row.id));
	return ids.filter((id) => !done.has(id));
}
