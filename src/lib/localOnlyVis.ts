/** Visibility helper for local-only.json. No Node imports — safe for the Svelte bundle. */

export function localOnlyCoversId(id: string, flagged: Iterable<string>): boolean {
	const set = flagged instanceof Set ? flagged : new Set(flagged);
	if (set.has(id)) return true;
	if (id.endsWith('-site')) {
		const stem = id.slice(0, -'-site'.length);
		return stem.length > 0 && set.has(stem);
	}
	return false;
}
