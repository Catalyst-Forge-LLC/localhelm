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

/** Situation lamps: same lists as Today’s write buttons, plus broken-folder / npm errors. */
export type HeaderNeedCounts = {
	publish: number;
	push: number;
	pins: number;
	dirty: number;
	missing: number;
	npmErrors: number;
};

export type HeaderNeedChip = {
	id: string;
	label: string;
	count: number;
	word: string;
	tone: 'hot' | 'warm' | 'bad';
	tab: 'today' | 'fleet';
	need: 'all' | 'publish' | 'push' | 'pins';
};

function needChip(
	id: HeaderNeedChip['id'],
	count: number,
	word: string,
	tone: HeaderNeedChip['tone'],
	need: HeaderNeedChip['need'],
): HeaderNeedChip {
	return { id, label: `${count} ${word}`, count, word, tone, tab: 'today', need };
}

/** Header only shows work. Zero counts stay off the chrome. */
export function headerNeedChips(counts: HeaderNeedCounts): HeaderNeedChip[] {
	const chips: HeaderNeedChip[] = [];
	if (counts.publish > 0) {
		chips.push(needChip('publish', counts.publish, 'publish', 'hot', 'publish'));
	}
	if (counts.push > 0) {
		chips.push(needChip('push', counts.push, 'push', 'hot', 'push'));
	}
	if (counts.dirty > 0) {
		chips.push(needChip('dirty', counts.dirty, 'dirty', 'warm', 'all'));
	}
	if (counts.pins > 0) {
		chips.push(
			needChip('pins', counts.pins, counts.pins === 1 ? 'pin behind' : 'pins behind', 'warm', 'pins'),
		);
	}
	if (counts.missing > 0) {
		chips.push(needChip('missing', counts.missing, 'missing', 'bad', 'all'));
	}
	if (counts.npmErrors > 0) {
		chips.push(needChip('npm', counts.npmErrors, 'npm errors', 'bad', 'all'));
	}
	return chips;
}

export type BridgeIdleInput = {
	fleetCount: number;
	hiddenCount?: number;
	fetchedAt: string | null;
	staleCount?: number;
	npmUser: string | null;
	/** No manifest, or a manifest with zero rows. Not “all archived.” */
	noFleet?: boolean;
	demo?: boolean;
};

export type BridgeGauge = {
	id: 'fleet' | 'sites' | 'slips';
	label: string;
	count: number;
	need: number;
};

/** Need share of the count, 0..1. Empty sets stay 0 (quiet ring). */
export function bridgeGaugeFrac(count: number, need: number): number {
	if (count <= 0) return 0;
	return Math.min(1, Math.max(0, need / count));
}

/** Circumference of the 14px-radius HUD dial. */
export const BRIDGE_GAUGE_C = 2 * Math.PI * 14;

/** Keel idle copy. Order: Fleet N · hidden · remotes · stale · npm */
export function bridgeIdleLine(input: BridgeIdleInput): string {
	if (input.noFleet) {
		return input.demo ? 'Demo · No fleet yet · Add projects on Today' : 'No fleet yet · Add projects on Today';
	}
	const parts = input.demo ? [`Demo · Fleet ${input.fleetCount}`] : [`Fleet ${input.fleetCount}`];
	if ((input.hiddenCount ?? 0) > 0) parts.push(`${input.hiddenCount} hidden`);
	parts.push(input.fetchedAt ? `remotes fetched ${input.fetchedAt}` : 'remotes not fetched this session');
	if ((input.staleCount ?? 0) > 0) parts.push(`${input.staleCount} could not be read`);
	parts.push(input.npmUser ? `npm ${input.npmUser}` : 'npm not signed in');
	return parts.join(' · ');
}

export function bridgeServeHeading(input: {
	host: string | null;
	port: string | null;
	portSource: string | null;
}): { hostPort: string; note: string } {
	if (!input.port) return { hostPort: '', note: '' };
	const allIfaces = !input.host || input.host === '0.0.0.0' || input.host === '::';
	const hostPort = allIfaces ? `:${input.port}` : `${input.host}:${input.port}`;
	const note =
		input.portSource === 'localslip'
			? 'port leased from LocalSlip'
			: input.portSource === 'flag'
				? '--port'
				: allIfaces
					? 'on all interfaces'
					: '';
	return { hostPort, note };
}

export function fleetVersionLabel(row: FleetVersionRow): string {
	const local = (row.localVersion ?? '').trim() || '—';
	const note = fleetVersionNote(row);
	return note ? `${local} · ${note}` : local;
}
