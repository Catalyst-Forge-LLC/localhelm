import { familyRole, familyStem, groupIdsByFamily, hasExactOrSiteLease, siteLeaseName } from './family.js';

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
	/** LocalSlip name to claim when this look is a missing site slip. */
	leaseName?: string;
};

export type PortLookGroup = {
	id: string;
	title: string;
	details: string[];
	kinds: PortLookKind[];
	leaseIds: string[];
	leaseName?: string;
};

export type LookJumpId = 'ports' | 'stacks' | 'fleet' | 'add' | 'claim';

export type LookJump = {
	id: LookJumpId;
	label: string;
	title: string;
};

/** Where the operator can act — Ports cannot enroll. Claim is a LocalSlip plugin write. */
export function lookJump(kind: PortLookKind, opts?: { enrolled?: boolean }): LookJump {
	if (kind === 'no-recipe') {
		return { id: 'ports', label: 'Open Ports', title: 'Save a start recipe on this lease.' };
	}
	if (kind === 'family-split') {
		return { id: 'stacks', label: 'Open Stacks', title: 'Start or stop the down members of this stack.' };
	}
	if (kind === 'lease-without-fleet') {
		return { id: 'add', label: 'Add', title: 'This lease is not enrolled. Scan and enroll it from Add.' };
	}
	if (kind === 'fleet-without-lease') {
		return {
			id: 'claim',
			label: 'Lease',
			title: 'Claim a LocalSlip port for this site. LocalSlip picks a free port (--or-next).',
		};
	}
	if (kind === 'cwd-missing' && opts?.enrolled) {
		return { id: 'fleet', label: 'Open Fleet', title: 'The recipe folder is missing. Fleet has the project path.' };
	}
	return {
		id: 'ports',
		label: 'Open Ports',
		title: 'Recipe folder is missing. Ports shows the lease.',
	};
}

export function lookJumpsFor(kinds: PortLookKind[], opts?: { enrolled?: boolean }): LookJump[] {
	const seen = new Set<LookJumpId>();
	const jumps: LookJump[] = [];
	for (const kind of kinds) {
		const jump = lookJump(kind, opts);
		if (seen.has(jump.id)) continue;
		seen.add(jump.id);
		jumps.push(jump);
	}
	return jumps;
}

const SKIP_LEASE_WITHOUT_FLEET = new Set(['localslip', 'localberth']);

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

export function portLooks(opts: {
	fleetIds: string[];
	leaseRows: LeaseRowInput[];
	siteIds?: string[];
	/** Lease names that count as claimed, including parked. Defaults to leaseRows. */
	claimedIds?: Iterable<string>;
}): PortLook[] {
	const { fleetIds, leaseRows, siteIds = [] } = opts;
	const fleetStems = new Set(fleetIds.map((id) => familyStem(id)));
	const claimed = new Set(opts.claimedIds ? [...opts.claimedIds] : leaseRows.map((row) => row.id));
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
	}

	const enrolledIds = [...new Set([...fleetIds, ...siteIds])].sort((a, b) => a.localeCompare(b));
	const siteSet = new Set(siteIds);
	for (const id of enrolledIds) {
		if (hasExactOrSiteLease(id, claimed)) continue;
		const wantsSiteLease = familyRole(id) === 'site' || siteSet.has(id);
		if (!wantsSiteLease) continue;
		looks.push({
			id: `fleet-without-lease:${id}`,
			title: id,
			detail: 'Site has no port lease',
			leaseIds: [],
			leaseName: siteLeaseName(id),
			kind: 'fleet-without-lease',
		});
	}

	return looks;
}

export function groupPortLooks(looks: PortLook[]): PortLookGroup[] {
	const groups = new Map<string, PortLookGroup>();
	for (const look of looks) {
		const existing = groups.get(look.title);
		if (!existing) {
			groups.set(look.title, {
				id: look.title,
				title: look.title,
				details: [look.detail],
				kinds: [look.kind],
				leaseIds: [...look.leaseIds],
				leaseName: look.leaseName,
			});
			continue;
		}
		if (!existing.leaseName && look.leaseName) existing.leaseName = look.leaseName;
		if (!existing.details.includes(look.detail)) existing.details.push(look.detail);
		if (!existing.kinds.includes(look.kind)) existing.kinds.push(look.kind);
		for (const id of look.leaseIds) {
			if (!existing.leaseIds.includes(id)) existing.leaseIds.push(id);
		}
	}
	return [...groups.values()].sort((a, b) => a.title.localeCompare(b.title));
}
