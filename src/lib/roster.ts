import type { FleetProject } from './types.js';

export type FleetRosterRow = {
	id: string;
	path: string;
	npm?: string;
	group?: string;
};

/** Manifest shells only — no git, npm, or plugin reads. */
export function fleetRoster(projects: readonly FleetProject[]): FleetRosterRow[] {
	return projects.map((project) => {
		const row: FleetRosterRow = { id: project.id, path: project.path };
		if (project.npm) row.npm = project.npm;
		if (project.group) row.group = project.group;
		return row;
	});
}
