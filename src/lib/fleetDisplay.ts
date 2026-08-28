export type FleetVersionRow = {
	localVersion: string | null;
	private: boolean;
	unpublishedAhead?: boolean;
	npm: { status: string; latest?: string; error?: string };
};

export function fleetProjectMeta(id: string, npmName: string | undefined, path: string): string | null {
	const name = (npmName ?? '').trim();
	if (name && name.toLowerCase() !== id.toLowerCase()) return name;
	if (!name && path.trim()) return path;
	return null;
}

export function fleetVersionNote(row: FleetVersionRow): string | null {
	const local = (row.localVersion ?? '').trim();
	if (row.private) return 'private';
	if (row.npm.status === 'error') return 'lookup failed';
	if (row.npm.status === 'none') return 'not published';
	const latest = (row.npm.latest ?? '').trim();
	if (row.npm.status === 'ok' && latest && latest !== local) return `npm ${latest}`;
	return null;
}

export type FleetDigestCounts = {
	unpublishedAhead: number;
	dirty: number;
	cascadeBehind: number;
	missing: number;
	npmErrors: number;
};

export type HeaderNeedChip = {
	id: string;
	label: string;
	tone: 'hot' | 'warm' | 'bad';
	tab: 'today' | 'fleet';
};

/** Header only shows work. Zero counts stay off the chrome. */
export function headerNeedChips(digest: FleetDigestCounts): HeaderNeedChip[] {
	const chips: HeaderNeedChip[] = [];
	if (digest.unpublishedAhead > 0) {
		chips.push({
			id: 'unpublished',
			label: `${digest.unpublishedAhead} unpublished`,
			tone: 'hot',
			tab: 'today',
		});
	}
	if (digest.dirty > 0) {
		chips.push({ id: 'dirty', label: `${digest.dirty} dirty`, tone: 'warm', tab: 'today' });
	}
	if (digest.cascadeBehind > 0) {
		chips.push({
			id: 'pins',
			label: digest.cascadeBehind === 1 ? '1 pin behind' : `${digest.cascadeBehind} pins behind`,
			tone: 'warm',
			tab: 'today',
		});
	}
	if (digest.missing > 0) {
		chips.push({ id: 'missing', label: `${digest.missing} missing`, tone: 'bad', tab: 'today' });
	}
	if (digest.npmErrors > 0) {
		chips.push({ id: 'npm', label: `${digest.npmErrors} npm errors`, tone: 'bad', tab: 'today' });
	}
	return chips;
}

export function fleetVersionLabel(row: FleetVersionRow): string {
	const local = (row.localVersion ?? '').trim() || '—';
	const note = fleetVersionNote(row);
	return note ? `${local} · ${note}` : local;
}
