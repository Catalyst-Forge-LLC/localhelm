export type CrossChip = {
	kind: 'fleet' | 'sites' | 'ports';
	label: string;
};

/** Chips for the other boards that already have this id. */
export function crosswalkChips(
	id: string,
	opts: {
		fleetIds: Iterable<string>;
		siteIds: Iterable<string>;
		leaseIds: Iterable<string>;
		hide?: CrossChip['kind'];
	},
): CrossChip[] {
	const fleet = new Set(opts.fleetIds);
	const sites = new Set(opts.siteIds);
	const leases = new Set(opts.leaseIds);
	const chips: CrossChip[] = [];
	if (fleet.has(id)) chips.push({ kind: 'fleet', label: 'Package' });
	if (sites.has(id)) chips.push({ kind: 'sites', label: 'Site' });
	if (leases.has(id)) chips.push({ kind: 'ports', label: 'Ports' });
	return opts.hide ? chips.filter((chip) => chip.kind !== opts.hide) : chips;
}
