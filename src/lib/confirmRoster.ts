import type { ConfirmPhase } from './confirmProgress.js';

export type ConfirmRosterStep = {
	text: string;
	phase: ConfirmPhase;
};

export type ConfirmRosterGroup = {
	id: string;
	phase: ConfirmPhase;
	done: number;
	total: number;
	steps: ConfirmRosterStep[];
};

/** `coldeye:2` is a publish or Land step; `coldeye` is the whole package (pull/push). */
export function confirmGroupId(key: string): string {
	const match = /^(.+):(\d+)$/.exec(key);
	return match?.[1] ?? key;
}

export function confirmStepLabel(groupId: string, item: string): string {
	if (item.startsWith(`${groupId}  `)) return item.slice(groupId.length + 2);
	if (item.startsWith(`${groupId}\n`)) return item.slice(groupId.length + 1);
	return item;
}

export function confirmGroupPhase(phases: readonly ConfirmPhase[]): ConfirmPhase {
	if (phases.includes('fail')) return 'fail';
	if (phases.includes('current')) return 'current';
	if (phases.length > 0 && phases.every((phase) => phase === 'done')) return 'done';
	return 'pending';
}

function looksLikeName(id: string): boolean {
	return /[a-zA-Z_-]/.test(id);
}

/**
 * Two or more named subjects become a roster. A single package, or a list of
 * anonymous index keys, stays a flat confirm list.
 */
export function buildConfirmRoster(
	items: readonly string[],
	keys: readonly string[],
	phases: readonly ConfirmPhase[] = [],
): ConfirmRosterGroup[] | null {
	if (items.length < 2) return null;
	const resolved = keys.length === items.length ? [...keys] : items.map((_, i) => String(i));
	const ids = resolved.map(confirmGroupId);
	if (ids.some((id) => !looksLikeName(id))) return null;
	const unique = [...new Set(ids)];
	if (unique.length < 2) return null;

	return unique.map((id) => {
		const steps: ConfirmRosterStep[] = [];
		ids.forEach((groupId, i) => {
			if (groupId !== id) return;
			steps.push({
				text: confirmStepLabel(id, items[i] ?? ''),
				phase: phases[i] ?? 'pending',
			});
		});
		return {
			id,
			phase: confirmGroupPhase(steps.map((step) => step.phase)),
			done: steps.filter((step) => step.phase === 'done').length,
			total: steps.length,
			steps,
		};
	});
}

/** Pinned row wins; otherwise follow the running (or failed) group. */
export function confirmRosterSelected(
	groups: readonly ConfirmRosterGroup[],
	pinned: string | null,
): string | null {
	if (pinned && groups.some((group) => group.id === pinned)) return pinned;
	return (
		groups.find((group) => group.phase === 'current')?.id ??
		groups.find((group) => group.phase === 'fail')?.id ??
		groups[0]?.id ??
		null
	);
}
