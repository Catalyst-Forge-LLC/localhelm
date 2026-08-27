export type PortFirewallFilter = 'applied' | 'needs-elevation' | 'skipped' | 'wanted';

/** Same chip groups as the LocalSlip dashboard FilterBar. */
export type PortBoardFilters = {
	listening?: boolean;
	/** true = not loopback; false = loopback. */
	lan?: boolean;
	firewall?: PortFirewallFilter;
	conflict?: true;
	ephemeral?: true;
};

export function bindIsLan(bind: string): boolean {
	const raw = bind.trim().toLowerCase().replace(/^\[|\]$/g, '');
	if (!raw || raw === '—') return false;
	if (raw === '127.0.0.1' || raw === '::1' || raw === 'localhost') return false;
	return true;
}

export function portFiltersActive(filters: PortBoardFilters): boolean {
	return (
		filters.listening !== undefined ||
		filters.lan !== undefined ||
		Boolean(filters.firewall) ||
		Boolean(filters.conflict) ||
		Boolean(filters.ephemeral)
	);
}

export function rowMatchesPortFilters(
	cells: Record<string, string>,
	filters: PortBoardFilters,
	variant: 'leases' | 'observed',
): boolean {
	if (variant === 'leases') {
		if (filters.listening !== undefined) {
			const up = cells.listening === 'yes';
			if (up !== filters.listening) return false;
		}
		if (filters.firewall && (cells.firewall ?? '') !== filters.firewall) return false;
		if (filters.conflict && cells.conflict !== 'yes') return false;
		if (filters.ephemeral && cells.kind !== 'ephemeral') return false;
	}
	if (filters.lan !== undefined && bindIsLan(cells.bind ?? '') !== filters.lan) return false;
	return true;
}
