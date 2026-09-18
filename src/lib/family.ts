/** Strip one trailing -site/-api, then fold hyphens. `file` and `filepress` stay distinct. */
export function familyStem(id: string): string {
	let value = id.trim().toLowerCase();
	if (value.endsWith('-site') && value.length > 5) value = value.slice(0, -5);
	else if (value.endsWith('-api') && value.length > 4) value = value.slice(0, -4);
	return value.replace(/-/g, '');
}

export function familyRole(id: string): 'ui' | 'api' | 'site' {
	const value = id.trim().toLowerCase();
	if (value.endsWith('-api')) return 'api';
	if (value.endsWith('-site')) return 'site';
	return 'ui';
}

/** FilePress preview slip. `coldeye` claims `coldeye-site`; a name that already ends in `-site` stays. */
export function siteLeaseName(id: string): string {
	const value = id.trim();
	if (!value) return value;
	return familyRole(value) === 'site' ? value : `${value}-site`;
}

export function hasExactOrSiteLease(id: string, claimed: Iterable<string>): boolean {
	const names = [...claimed].map((name) => name.trim()).filter(Boolean);
	if (names.includes(id) || names.includes(siteLeaseName(id))) return true;
	const stem = familyStem(id);
	if (!stem) return false;
	return names.some((name) => familyRole(name) === 'site' && familyStem(name) === stem);
}

export function familyMemberNames(seed: string, names: Iterable<string>): string[] {
	const stem = familyStem(seed);
	if (!stem) return [];
	return [...names].filter((name) => familyStem(name) === stem);
}

export function groupIdsByFamily(ids: Iterable<string>): Map<string, string[]> {
	const groups = new Map<string, string[]>();
	for (const id of ids) {
		const stem = familyStem(id);
		if (!stem) continue;
		const list = groups.get(stem) ?? [];
		list.push(id);
		groups.set(stem, list);
	}
	return groups;
}
