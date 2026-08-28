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

export function applyConfirmStep(
	keys: string[],
	phases: ConfirmPhase[],
	event: { id: string; index: number; status: 'start' | 'done' | 'fail' },
): ConfirmPhase[] {
	return markConfirmKey(keys, phases, `${event.id}:${event.index}`, event.status === 'start' ? 'current' : event.status);
}
