/** Longest known fleet/lease ids that appear as tokens in an activity title. */
export function activityLinkedIds(title: string, known: Iterable<string>): string[] {
	const ids = [...new Set([...known].filter(Boolean))].sort((a, b) => b.length - a.length);
	if (!ids.length) return [];
	const found: string[] = [];
	for (const id of ids) {
		const escaped = id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
		const re = new RegExp(`(?<![A-Za-z0-9_-])${escaped}(?![A-Za-z0-9_-])`);
		if (re.test(title)) found.push(id);
	}
	return found.sort((a, b) => title.indexOf(a) - title.indexOf(b));
}
