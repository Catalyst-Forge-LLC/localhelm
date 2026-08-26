import { countCommitsSinceVersion, readGit } from './git.js';
import type { LoadedManifest } from './manifest.js';
import { clearNpmCache, liftLatestIfVersionExists, npmLatest } from './npm.js';
import { joinRoot } from './paths.js';
import { pinsFromPkg } from './pins.js';
import { collectDeps, pathExists, readPkg, rootPkgPath, sitePkgPath, type PkgJson } from './pkg.js';
import { compareSemver } from './semver.js';
import type { FleetDigest, FleetInventory, PinEdge, ProjectStatus } from './types.js';

export type StatusOptions = {
	fetch?: boolean;
	/** When set, only these project ids are read (npm + git). Faster for Land. */
	onlyIds?: string[];
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
	// One request per package name *per run*. A long-lived `serve` must not keep yesterday's latest.
	clearNpmCache();
	const prepared: Prepared[] = [];
	const names = new Set<string>();
	const only = options.onlyIds?.length ? new Set(options.onlyIds) : null;

	for (const project of loaded.manifest.projects) {
		if (only && !only.has(project.id)) continue;
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

	if (only) {
		const fleetNames = new Set(
			loaded.manifest.projects.map((project) => project.npm).filter((name): name is string => Boolean(name)),
		);
		for (const row of prepared) {
			for (const pkg of [row.rootPkg, row.sitePkg]) {
				if (!pkg) continue;
				for (const name of Object.keys(collectDeps(pkg))) {
					if (fleetNames.has(name)) names.add(name);
				}
			}
		}
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

		let npm = row.privatePkg
			? { name: row.npmName, status: 'private' as const }
			: row.npmName
				? await npmLatest(row.npmName)
				: { status: 'none' as const };
		if (!row.privatePkg && row.npmName && row.localVersion && npm.status === 'ok') {
			npm = await liftLatestIfVersionExists(row.npmName, row.localVersion, npm);
			if (npm.latest) latestByName.set(row.npmName, npm.latest);
		}

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

		const git = readGit(row.absPath, options.fetch === true);
		const publishedVersion =
			!row.privatePkg && npm.status === 'ok' && npm.latest ? npm.latest : row.localVersion;
		const status: ProjectStatus = {
			id: row.id,
			path: row.path,
			absPath: row.absPath,
			missing: false,
			localVersion: row.localVersion,
			private: row.privatePkg,
			npm,
			git,
			pins,
			cascadeBehind: pins.filter((pin) => pin.kind === 'registry' && pin.onLatest === false).length,
			unpublishedAhead,
			commitsSinceNpm:
				publishedVersion && git.repo && git.branch
					? countCommitsSinceVersion(row.absPath, publishedVersion, git.branch)
					: null,
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
