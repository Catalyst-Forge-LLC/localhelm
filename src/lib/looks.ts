import { familyRole, familyStem, groupIdsByFamily } from './family.js';

export type LeaseRowInput = {
	id: string;
	cells: Record<string, string>;
};

export type FamilyMember = {
	id: string;
	role: 'ui' | 'api' | 'site';
	listening: boolean | null;
	hasLease: boolean;
	hasFleet: boolean;
};

export type PortFamily = {
	stem: string;
	label: string;
	members: FamilyMember[];
	bits: string;
	leaseIds: string[];
};

export type PortLookKind =
	| 'no-recipe'
	| 'cwd-missing'
	| 'family-split'
	| 'lease-without-fleet'
	| 'fleet-without-lease';

export type PortLook = {
	id: string;
	title: string;
	detail: string;
	leaseIds: string[];
	kind: PortLookKind;
};

const SKIP_LEASE_WITHOUT_FLEET = new Set(['localberth']);

function listeningOf(cells: Record<string, string>): boolean | null {
	if (cells.listening === 'yes') return true;
	if (cells.listening === 'no') return false;
	return null;
}

export function familyListenBits(members: FamilyMember[]): string {
	const labels = { ui: 'UI', api: 'API', site: 'site' } as const;
	const parts: string[] = [];
	for (const role of ['ui', 'api', 'site'] as const) {
		const hits = members.filter((member) => member.role === role && member.hasLease);
		if (!hits.length) continue;
		const up = hits.some((member) => member.listening === true);
		const down = hits.some((member) => member.listening === false);
		const state = up && !down ? 'up' : !up && down ? 'down' : up && down ? 'split' : '—';
		parts.push(`${labels[role]} ${state}`);
	}
	return parts.join(' · ') || 'no leases';
}

export function portFamilies(opts: { fleetIds: string[]; leaseRows: LeaseRowInput[] }): PortFamily[] {
	const { fleetIds, leaseRows } = opts;
	const leaseById = new Map(leaseRows.map((row) => [row.id, row]));
	const ids = new Set<string>([...fleetIds, ...leaseRows.map((row) => row.id)]);
	const families: PortFamily[] = [];
	for (const [stem, members] of groupIdsByFamily(ids)) {
		const items: FamilyMember[] = members.map((id) => {
			const lease = leaseById.get(id);
			return {
				id,
				role: familyRole(id),
				listening: lease ? listeningOf(lease.cells) : null,
				hasLease: Boolean(lease),
				hasFleet: fleetIds.includes(id),
			};
		});
		const leaseIds = items.filter((item) => item.hasLease).map((item) => item.id);
		if (items.length < 2 && leaseIds.length < 2) continue;
		const ui = items.find((item) => item.role === 'ui');
		const label = ui?.id ?? items[0]?.id ?? stem;
		families.push({
			stem,
			label,
			members: items,
			bits: familyListenBits(items),
			leaseIds,
		});
	}
	return families.sort((a, b) => a.label.localeCompare(b.label));
}

export function portLooks(opts: { fleetIds: string[]; leaseRows: LeaseRowInput[] }): PortLook[] {
	const { fleetIds, leaseRows } = opts;
	const fleetStems = new Set(fleetIds.map((id) => familyStem(id)));
	const looks: PortLook[] = [];

	for (const row of leaseRows) {
		const recipe = (row.cells.recipe ?? '').trim();
		if (!recipe || recipe === '—') {
			looks.push({
				id: `no-recipe:${row.id}`,
				title: row.id,
				detail: 'No start recipe',
				leaseIds: [row.id],
				kind: 'no-recipe',
			});
		}
		if (row.cells.cwdOk === 'no') {
			looks.push({
				id: `cwd-missing:${row.id}`,
				title: row.id,
				detail: 'Recipe folder is missing',
				leaseIds: [row.id],
				kind: 'cwd-missing',
			});
		}
		const role = familyRole(row.id);
		const stem = familyStem(row.id);
		const siteOfFleet = (role === 'api' || role === 'site') && fleetStems.has(stem);
		if (!SKIP_LEASE_WITHOUT_FLEET.has(row.id) && !fleetStems.has(stem) && !siteOfFleet) {
			looks.push({
				id: `lease-without-fleet:${row.id}`,
				title: row.id,
				detail: 'Lease has no matching fleet row',
				leaseIds: [row.id],
				kind: 'lease-without-fleet',
			});
		}
	}

	for (const family of portFamilies(opts)) {
		const leases = family.members.filter((member) => member.hasLease);
		const up = leases.filter((member) => member.listening === true).length;
		const down = leases.filter((member) => member.listening === false).length;
		if (leases.length >= 2 && up > 0 && down > 0) {
			looks.push({
				id: `family-split:${family.stem}`,
				title: family.label,
				detail: `Family split — ${family.bits}`,
				leaseIds: family.leaseIds,
				kind: 'family-split',
			});
		}
		const hasFleet = family.members.some((member) => member.hasFleet);
		const uiFleet = family.members.find((member) => member.role === 'ui' && member.hasFleet);
		const uiLease = family.members.find((member) => member.role === 'ui' && member.hasLease);
		if (hasFleet && family.leaseIds.length > 0 && uiFleet && !uiLease) {
			looks.push({
				id: `fleet-without-lease:${family.stem}`,
				title: uiFleet.id,
				detail: 'Fleet row has no UI lease',
				leaseIds: family.leaseIds,
				kind: 'fleet-without-lease',
			});
		}
	}

	return looks;
}
