import { compareSemver } from './semver.js';
import type { FleetDigest, GitCell, NpmCell, ProjectStatus } from './types.js';

export type WriteReloadMode = 'git' | 'light';

export type WritePatch = {
	id: string;
	gitAhead?: number | null;
	gitBehind?: number | null;
	gitDirty?: boolean;
	localVersion?: string | null;
	npmLatest?: string;
	unpublishedAhead?: boolean;
	commitsSinceNpm?: number | null;
	globalVersion?: string | null;
};

export type PatchableProject = Pick<
	ProjectStatus,
	'id' | 'git' | 'npm' | 'localVersion' | 'private' | 'unpublishedAhead' | 'commitsSinceNpm' | 'global'
>;

export function writeReloadBusy(mode: WriteReloadMode, ids: readonly string[]): string {
	const named = ids.filter(Boolean);
	const verb = mode === 'git' ? 'reading git' : 'reading fleet';
	if (named.length === 1) return `${verb} · ${named[0]}`;
	return `${verb} (${named.length} projects)`;
}

export function unpublishedAheadOf(
	localVersion: string | null,
	npm: Pick<NpmCell, 'status' | 'latest'>,
	privatePkg: boolean,
): boolean {
	if (privatePkg || !localVersion) return false;
	if (npm.status === 'ok' && npm.latest) {
		const cmp = compareSemver(localVersion, npm.latest);
		return cmp !== null && cmp > 0;
	}
	return npm.status === 'none';
}

export function applyWritePatch<T extends PatchableProject>(row: T, patch: WritePatch): T {
	if (patch.id !== row.id) return row;
	const git: GitCell = { ...row.git };
	if (patch.gitAhead !== undefined) git.ahead = patch.gitAhead;
	if (patch.gitBehind !== undefined) git.behind = patch.gitBehind;
	if (patch.gitDirty !== undefined) git.dirty = patch.gitDirty;
	const npm: NpmCell = { ...row.npm };
	if (patch.npmLatest) {
		npm.latest = patch.npmLatest;
		npm.status = 'ok';
		npm.error = undefined;
	}
	const localVersion = patch.localVersion !== undefined ? patch.localVersion : row.localVersion;
	const unpublishedAhead =
		patch.unpublishedAhead !== undefined
			? patch.unpublishedAhead
			: patch.localVersion !== undefined || patch.npmLatest
				? unpublishedAheadOf(localVersion, npm, row.private)
				: row.unpublishedAhead;
	return {
		...row,
		git,
		npm,
		localVersion,
		unpublishedAhead,
		commitsSinceNpm: patch.commitsSinceNpm !== undefined ? patch.commitsSinceNpm : row.commitsSinceNpm,
		global:
			patch.globalVersion !== undefined
				? { version: patch.globalVersion }
				: row.global,
	};
}

export function applyWritePatches<T extends PatchableProject>(projects: T[], patches: readonly WritePatch[]): T[] {
	if (!patches.length) return projects;
	const byId = new Map(patches.map((patch) => [patch.id, patch]));
	return projects.map((row) => {
		const patch = byId.get(row.id);
		return patch ? applyWritePatch(row, patch) : row;
	});
}

export function digestFromProjects(
	projects: ReadonlyArray<{
		git: Pick<GitCell, 'dirty'>;
		unpublishedAhead: boolean;
		cascadeBehind: number;
		missing: boolean;
		npm: Pick<NpmCell, 'status'>;
	}>,
): FleetDigest {
	return {
		projects: projects.length,
		dirty: projects.filter((row) => row.git.dirty).length,
		unpublishedAhead: projects.filter((row) => row.unpublishedAhead).length,
		cascadeBehind: projects.filter((row) => row.cascadeBehind > 0).length,
		missing: projects.filter((row) => row.missing).length,
		npmErrors: projects.filter((row) => row.npm.status === 'error').length,
	};
}
