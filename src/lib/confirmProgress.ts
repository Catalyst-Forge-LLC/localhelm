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

/** One Ollama chat at a time. Hint stays up until the last draft lands. */
export function commitDraftProgressHint(opts: {
	ids: readonly string[];
	pending: readonly string[];
	selected?: string;
	notes?: Record<string, string>;
}): string {
	const ids = opts.ids.filter(Boolean);
	const pending = opts.pending.filter(Boolean);
	const notes = opts.notes ?? {};
	const total = ids.length;
	if (!total) return '';
	if (pending.length) {
		const now = pending[0] ?? '';
		const n = total - pending.length + 1;
		const selected = opts.selected && pending.includes(opts.selected) ? opts.selected : now;
		if (selected && selected !== now) {
			return `Queued for Ollama… ${n} of ${total} (now ${now}).`;
		}
		return `Asking Ollama… ${n} of ${total}${now ? ` (${now})` : ''}. One at a time.`;
	}
	if (opts.selected && notes[opts.selected]) return notes[opts.selected];
	const ollama = Object.values(notes).filter((note) => /^Ollama \(/.test(note)).length;
	const fallback = total - ollama;
	if (ollama && !fallback) {
		return `Ollama drafted ${total} message${total === 1 ? '' : 's'}. Edit if you want.`;
	}
	if (ollama && fallback) {
		return `Ollama drafted ${ollama}; ${fallback} used a fallback. Edit if you want.`;
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
