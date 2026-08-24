/**
 * Round-trip helpers for comma-separated list URL params (e.g. `?fleet=a,b,c`).
 * Kept free of SvelteKit imports so the behavior is unit-testable in isolation.
 */

export function parseListParam(value: string | null | undefined, maxItems = 64): string[] {
	if (!value) return [];
	const seen = new Set<string>();
	const out: string[] = [];
	for (const part of value.split(',')) {
		const trimmed = part.trim();
		if (!trimmed || seen.has(trimmed)) continue;
		seen.add(trimmed);
		out.push(trimmed);
		if (out.length >= maxItems) break;
	}
	return out;
}

/** Canonical CSV, or null when empty so the caller can drop the param. */
export function serializeListParam(ids: readonly string[]): string | null {
	const seen = new Set<string>();
	const out: string[] = [];
	for (const id of ids) {
		const trimmed = id.trim();
		if (!trimmed || seen.has(trimmed)) continue;
		seen.add(trimmed);
		out.push(trimmed);
	}
	return out.length === 0 ? null : out.join(',');
}

export function listsEqual(a: readonly string[], b: readonly string[]): boolean {
	if (a.length !== b.length) return false;
	for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
	return true;
}

export function idsToSelection(ids: readonly string[]): Record<string, boolean> {
	const next: Record<string, boolean> = {};
	for (const id of ids) next[id] = true;
	return next;
}

export function selectionToIds(selected: Record<string, boolean>): string[] {
	return Object.keys(selected)
		.filter((id) => selected[id])
		.sort();
}
