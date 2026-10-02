import { confirmGroupId } from './confirmRoster.js';

export type ConfirmPhase = 'pending' | 'current' | 'done' | 'fail';

export function emptyConfirmPhases(count: number): ConfirmPhase[] {
	return Array.from({ length: Math.max(0, count) }, () => 'pending');
}

/** Highlight one listed id (pull/push). The previous current item becomes done. */
export function markConfirmKey(keys: string[], phases: ConfirmPhase[], key: string, phase: ConfirmPhase): ConfirmPhase[] {
	const next = phases.slice();
	while (next.length < keys.length) next.push('pending');
	for (let i = 0; i < keys.length; i++) {
		if (keys[i] !== key) {
			if (phase === 'current' && next[i] === 'current') next[i] = 'done';
			continue;
		}
		next[i] = phase;
	}
	return next;
}

function sameConfirmSubject(key: string, id: string): boolean {
	return key === id || confirmGroupId(key) === id;
}

/** True when the confirm lists this id, including `id:0` commit and file steps. */
export function confirmHasSubject(keys: readonly string[], id: string): boolean {
	return keys.some((key) => sameConfirmSubject(key, id));
}

export function confirmSubjectFailed(keys: readonly string[], phases: readonly ConfirmPhase[], id: string): boolean {
	return keys.some((key, index) => sameConfirmSubject(key, id) && phases[index] === 'fail');
}

/**
 * Mark a pull/push subject. A bare id and its `id:n` steps are one subject,
 * so a multi-commit push row moves with the repo, not only an exact key.
 */
export function markConfirmSubject(
	keys: string[],
	phases: ConfirmPhase[],
	id: string,
	phase: ConfirmPhase,
): ConfirmPhase[] {
	const next = phases.slice();
	while (next.length < keys.length) next.push('pending');
	if (phase === 'current') {
		const leaving = new Set<string>();
		for (let i = 0; i < keys.length; i++) {
			const key = keys[i] ?? '';
			if (next[i] === 'current' && !sameConfirmSubject(key, id)) leaving.add(confirmGroupId(key));
		}
		let opened = false;
		for (let i = 0; i < keys.length; i++) {
			const key = keys[i] ?? '';
			if (sameConfirmSubject(key, id)) {
				if (!opened) {
					next[i] = 'current';
					opened = true;
				}
				continue;
			}
			if (leaving.has(confirmGroupId(key)) && next[i] !== 'fail') next[i] = 'done';
		}
		return next;
	}
	for (let i = 0; i < keys.length; i++) {
		if (sameConfirmSubject(keys[i] ?? '', id)) next[i] = phase;
	}
	return next;
}

/** Stable subject list so the first filled message cannot shrink “N of M”. */
export function commitDraftSubjectIds(opts: {
	planned?: readonly string[];
	pending?: readonly string[];
	messages?: Record<string, string>;
	notes?: Record<string, string>;
}): string[] {
	const seen = new Set<string>();
	const out: string[] = [];
	for (const id of [
		...(opts.planned ?? []),
		...(opts.pending ?? []),
		...Object.keys(opts.messages ?? {}),
		...Object.keys(opts.notes ?? {}),
	]) {
		if (!id || seen.has(id)) continue;
		seen.add(id);
		out.push(id);
	}
	return out;
}

function isOllamaNote(note: string | undefined): boolean {
	return Boolean(note && /^Ollama \(/.test(note));
}

/** Hint stays up until the last draft lands. */
export function commitDraftProgressHint(opts: {
	ids: readonly string[];
	pending: readonly string[];
	selected?: string;
	notes?: Record<string, string>;
}): string {
	const pending = opts.pending.filter(Boolean);
	const notes = opts.notes ?? {};
	const ids = commitDraftSubjectIds({ planned: opts.ids, pending, notes });
	const total = ids.length;
	if (!total) return '';
	if (pending.length) {
		const now = pending[0] ?? '';
		if (total === 1) return 'Asking Ollama…';
		const n = Math.min(total, Math.max(1, total - pending.length + 1));
		const selected = opts.selected && pending.includes(opts.selected) ? opts.selected : now;
		if (selected && selected !== now) {
			return `Queued for Ollama… ${n} of ${total} (now ${now}).`;
		}
		return `Asking Ollama… ${n} of ${total}${now ? ` (${now})` : ''}.`;
	}
	if (opts.selected && notes[opts.selected] && total === 1) return notes[opts.selected];
	const ollama = ids.filter((id) => isOllamaNote(notes[id])).length;
	const fallback = ids.filter((id) => notes[id] && !isOllamaNote(notes[id])).length;
	const blank = total - ollama - fallback;
	if (ollama && !fallback && !blank) {
		return `Ollama drafted ${total} message${total === 1 ? '' : 's'}. Edit if you want.`;
	}
	if (ollama && fallback && !blank) {
		return `Ollama drafted ${ollama}; ${fallback} used a fallback. Edit if you want.`;
	}
	if (ollama && blank) {
		return `Ollama drafted ${ollama} of ${total}. Edit if you want.`;
	}
	return notes[ids[0] ?? ''] ?? 'Edit the message, then confirm.';
}

export function applyConfirmStep(
	keys: string[],
	phases: ConfirmPhase[],
	event: { id: string; index: number; status: 'start' | 'done' | 'fail' },
): ConfirmPhase[] {
	return markConfirmKey(keys, phases, `${event.id}:${event.index}`, event.status === 'start' ? 'current' : event.status);
}
