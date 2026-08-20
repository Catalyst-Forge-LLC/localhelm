import type { FleetInventory, ProjectStatus } from './types.js';

export type ReadyRow = {
	id: string;
	localVersion: string | null;
	npmLatest?: string;
	eligible: boolean;
	reason?: string;
};

export type ReadyView = {
	rows: ReadyRow[];
	eligible: ReadyRow[];
};

function readyReason(row: ProjectStatus): string | undefined {
	if (row.missing) return 'folder missing';
	if (row.private) return 'private';
	if (!row.localVersion) return 'no local version';
	if (row.npm.status === 'error') return row.npm.error ?? 'npm lookup failed';
	if (!row.unpublishedAhead) return 'local is not ahead of npm';
	if (!row.git.repo) return 'not a git repo';
	if (row.git.busy) return `mid-${row.git.busy}`;
	if (row.git.dirty) return 'dirty';
	if (row.git.detached) return 'detached HEAD';
	return undefined;
}

export function fleetReady(inventory: FleetInventory): ReadyView {
	const rows = inventory.projects.map((row) => {
		const reason = readyReason(row);
		return {
			id: row.id,
			localVersion: row.localVersion,
			npmLatest: row.npm.latest,
			eligible: !reason,
			reason,
		};
	});
	return { rows, eligible: rows.filter((row) => row.eligible) };
}
