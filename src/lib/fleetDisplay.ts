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

export function fleetVersionLabel(row: FleetVersionRow): string {
	const local = (row.localVersion ?? '').trim() || '—';
	const note = fleetVersionNote(row);
	return note ? `${local} · ${note}` : local;
}
