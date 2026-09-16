/** Visibility helper for archive.json. No Node imports — safe for the Svelte bundle. */

export function archiveHidesId(id: string, archived: Iterable<string>): boolean {
	const hidden = archived instanceof Set ? archived : new Set(archived);
	if (hidden.has(id)) return true;
	if (id.endsWith('-site')) {
		const stem = id.slice(0, -'-site'.length);
		return stem.length > 0 && hidden.has(stem);
	}
	return false;
}
