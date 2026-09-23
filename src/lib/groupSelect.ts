/** Named selection helpers. No Node imports — safe for the Svelte bundle. */

export type SelectionGroup = {
	name: string;
	ids: string[];
};

export function sameGroupName(a: string, b: string): boolean {
	return a.trim().toLocaleLowerCase() === b.trim().toLocaleLowerCase();
}

/** Ids from the group that exist on this list. The rest are skipped. */
export function matchingGroupIds(groupIds: readonly string[], presentIds: readonly string[]): string[] {
	const present = new Set(presentIds);
	const seen = new Set<string>();
	const out: string[] = [];
	for (const id of groupIds) {
		if (!present.has(id) || seen.has(id)) continue;
		seen.add(id);
		out.push(id);
	}
	return out;
}
