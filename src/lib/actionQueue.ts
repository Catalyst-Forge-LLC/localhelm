/** Intents lined up behind a running batch. The plan is built when the intent starts. */

import { confirmGroupId } from './confirmRoster.js';

export const queueKinds = ['commit', 'bump', 'push', 'publish', 'ship', 'land'] as const;

export type QueueKind = (typeof queueKinds)[number];

export type ActionIntent = {
	id: string;
	kind: QueueKind;
	ids: string[];
};

export type QueueSkip = {
	id: string;
	kind: QueueKind;
};

const kindLabel: Record<QueueKind, string> = {
	commit: 'Commit',
	bump: 'Bump',
	push: 'Push',
	publish: 'Publish',
	ship: 'Ship',
	land: 'Land',
};

export function intentLabel(intent: Pick<ActionIntent, 'kind' | 'ids'>): string {
	const name = kindLabel[intent.kind];
	return intent.ids.length === 1 ? `${name} ${intent.ids[0]}` : `${name} ${intent.ids.length}`;
}

/** Append one intent. Blank ids are dropped. An empty list leaves the queue unchanged. */
export function enqueue(queue: readonly ActionIntent[], intent: ActionIntent): ActionIntent[] {
	const ids = [...new Set(intent.ids.map((id) => id.trim()).filter(Boolean))];
	if (!ids.length) return [...queue];
	return [...queue, { id: intent.id, kind: intent.kind, ids }];
}

export function removeIntent(queue: readonly ActionIntent[], id: string): ActionIntent[] {
	return queue.filter((item) => item.id !== id);
}

/**
 * Take the oldest intent that still has a repo to run.
 * Ids that failed an earlier intent are left out. An intent whose repos are all held is skipped.
 */
export function takeNext(
	queue: readonly ActionIntent[],
	blocked: ReadonlySet<string>,
): { queue: ActionIntent[]; next: ActionIntent | null; skipped: QueueSkip[] } {
	const skipped: QueueSkip[] = [];
	const rest = [...queue];
	while (rest.length) {
		const head = rest.shift();
		if (!head) break;
		const kept = head.ids.filter((id) => !blocked.has(id));
		for (const id of head.ids) {
			if (blocked.has(id)) skipped.push({ id, kind: head.kind });
		}
		if (kept.length) return { queue: rest, next: { ...head, ids: kept }, skipped };
	}
	return { queue: [], next: null, skipped };
}

export function holdLine(skipped: readonly QueueSkip[]): string {
	const ids = [...new Set(skipped.map((row) => row.id))];
	if (!ids.length) return '';
	return ids.length === 1
		? `${ids[0]} stays out of the queue — an earlier action failed.`
		: `${ids.join(', ')} stay out of the queue — an earlier action failed.`;
}

/** Repo ids whose confirm row failed. `repo:2` counts as `repo`. */
export function failedConfirmSubjects(keys: readonly string[], phases: readonly string[]): string[] {
	const seen = new Set<string>();
	const out: string[] = [];
	for (let i = 0; i < keys.length; i++) {
		if (phases[i] !== 'fail') continue;
		const id = confirmGroupId(keys[i] ?? '');
		if (!id || seen.has(id)) continue;
		seen.add(id);
		out.push(id);
	}
	return out;
}
