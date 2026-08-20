import { readGit } from './git.js';
import type { LoadedManifest } from './manifest.js';
import { npmLatest } from './npm.js';
import { joinRoot } from './paths.js';
import { pinsFromPkg } from './pins.js';
import { pathExists, readPkg, rootPkgPath, sitePkgPath, type PkgJson } from './pkg.js';
import { compareSemver } from './semver.js';
import type { FleetDigest, FleetInventory, PinEdge, ProjectStatus } from './types.js';

export type StatusOptions = {
	fetch?: boolean;
};

type Prepared = {
	id: string;
	path: string;
	absPath: string;
	missing: boolean;
	privatePkg: boolean;
	localVersion: string | null;
	npmName?: string;
	rootPkg?: PkgJson;
	rootError?: string;
	sitePkg?: PkgJson;
};

export async function fleetStatus(loaded: LoadedManifest, options: StatusOptions = {}): Promise<FleetInventory> {
	const prepared: Prepared[] = [];
	const names = new Set<string>();

	for (const project of loaded.manifest.projects) {
		const absPath = joinRoot(loaded.workspaceRoot, project.path);
		if (!(await pathExists(absPath))) {
			prepared.push({
				id: project.id,
				path: project.path,
				absPath,
				missing: true,
				privatePkg: false,
				localVersion: null,
				npmName: project.npm,
			});
			continue;
		}
		const rootFile = rootPkgPath(absPath);
		const rootRead = (await pathExists(rootFile)) ? await readPkg(rootFile) : null;
		const rootError = rootRead && 'error' in rootRead ? rootRead.error : undefined;
		const rootPkg = rootRead && !('error' in rootRead) ? rootRead : undefined;
		const npmName = project.npm ?? rootPkg?.name;
		if (npmName) names.add(npmName);
		let sitePkg: PkgJson | undefined;
		const siteFile = sitePkgPath(absPath);
		if (await pathExists(siteFile)) {
			const siteRead = await readPkg(siteFile);
			if (!('error' in siteRead)) sitePkg = siteRead;
		}
		prepared.push({
			id: project.id,
			path: project.path,
			absPath,
			missing: false,
			privatePkg: !!rootPkg?.private,
			localVersion: rootPkg?.version ?? null,
			npmName,
			rootPkg,
			rootError,
			sitePkg,
		});
	}

	const latestByName = new Map<string, string>();
	for (const name of names) {
		const cell = await npmLatest(name);
		if (cell.status === 'ok' && cell.latest) latestByName.set(name, cell.latest);
	}

	const projects: ProjectStatus[] = [];
	for (const row of prepared) {
		if (row.missing) {
			projects.push({
				id: row.id,
				path: row.path,
				absPath: row.absPath,
				missing: true,
				localVersion: null,
				private: false,
				npm: { name: row.npmName, status: 'none' },
				git: { repo: false, dirty: false, staged: 0, unstaged: 0, untracked: 0, ahead: null, behind: null },
				pins: [],
				cascadeBehind: 0,
				unpublishedAhead: false,
			});
			continue;
		}

		const npm = row.privatePkg
			? { name: row.npmName, status: 'private' as const }
			: row.npmName
				? await npmLatest(row.npmName)
				: { status: 'none' as const };

		const pins: PinEdge[] = [];
		if (row.rootPkg) {
			pins.push(...pinsFromPkg(row.id, 'root', row.rootPkg, loaded.manifest.projects, latestByName));
		}
		if (row.sitePkg) {
			pins.push(...pinsFromPkg(row.id, 'site', row.sitePkg, loaded.manifest.projects, latestByName));
		}

		let unpublishedAhead = false;
		if (!row.privatePkg && row.localVersion && npm.status === 'ok' && npm.latest) {
			const cmp = compareSemver(row.localVersion, npm.latest);
			unpublishedAhead = cmp !== null && cmp > 0;
		} else if (!row.privatePkg && row.localVersion && npm.status === 'none') {
			unpublishedAhead = true;
		}

		const status: ProjectStatus = {
			id: row.id,
			path: row.path,
			absPath: row.absPath,
			missing: false,
			localVersion: row.localVersion,
			private: row.privatePkg,
			npm,
			git: readGit(row.absPath, options.fetch === true),
			pins,
			cascadeBehind: pins.filter((pin) => pin.kind === 'registry' && pin.onLatest === false).length,
			unpublishedAhead,
		};
		if (row.rootError) status.error = row.rootError;
		projects.push(status);
	}

	const digest: FleetDigest = {
		projects: projects.length,
		dirty: projects.filter((p) => p.git.dirty).length,
		unpublishedAhead: projects.filter((p) => p.unpublishedAhead).length,
		cascadeBehind: projects.filter((p) => p.cascadeBehind > 0).length,
		missing: projects.filter((p) => p.missing).length,
		npmErrors: projects.filter((p) => p.npm.status === 'error').length,
	};

	return {
		workspaceRoot: loaded.workspaceRoot,
		manifestPath: loaded.manifestPath,
		digest,
		projects,
	};
}
