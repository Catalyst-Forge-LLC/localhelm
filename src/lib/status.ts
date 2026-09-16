import { countCommitsSinceVersion, GIT_POOL, readGitAsync } from './git.js';
import type { LoadedManifest } from './manifest.js';
import { clearNpmCache, liftLatestIfVersionExists, mapPool, npmLatestMany } from './npm.js';
import { joinRoot } from './paths.js';
import { pinsFromPkg } from './pins.js';
import { clearGlobalCache, readGlobalVersions } from './globalInstall.js';
import { collectDeps, pathExists, pkgBinNames, readPkg, rootPkgPath, shipScriptTarget, sitePkgPath, type PkgJson } from './pkg.js';
import { compareSemver } from './semver.js';
import type { FleetDigest, FleetInventory, GitCell, NpmCell, PinEdge, ProjectStatus } from './types.js';

const EMPTY_GIT: GitCell = {
	repo: false,
	dirty: false,
	staged: 0,
	unstaged: 0,
	untracked: 0,
	ahead: null,
	behind: null,
};

/** Publish only needs this count when a bump is still in play (local already matches npm). */
export function needsCommitsSinceNpm(
	row: { privatePkg: boolean; npmName?: string; localVersion: string | null },
	npm: Pick<NpmCell, 'status' | 'latest'>,
	unpublishedAhead: boolean,
	git: Pick<GitCell, 'repo' | 'branch' | 'busy' | 'detached' | 'dirty'>,
): boolean {
	if (row.privatePkg || unpublishedAhead) return false;
	if (!row.npmName || !row.localVersion) return false;
	if (npm.status !== 'ok' || !npm.latest) return false;
	if (!git.repo || !git.branch || git.busy || git.detached || git.dirty) return false;
	const cmp = compareSemver(row.localVersion, npm.latest);
	if (cmp !== null && cmp < 0) return false;
	return true;
}

export type StatusPhase = 'packages' | 'npm' | 'globals' | 'git';

export type StatusProgress = {
	phase: StatusPhase;
	label: string;
	done?: number;
	total?: number;
};

export type StatusOptions = {
	fetch?: boolean;
	/** When set, only these project ids are read (npm + git). Faster for Land. */
	onlyIds?: string[];
	/** Drop the in-process npm latest cache (Refresh / fetch remotes). */
	refreshNpm?: boolean;
	/** After a git write: re-read ahead/behind only. Skip npm, globals, and commit-since-npm. */
	gitOnly?: boolean;
	/** After a write: skip pickaxe commit-since-npm. npm cache still used unless refreshNpm. */
	skipCommitCounts?: boolean;
	/** `npm whoami` user. Seeds latest via `npm search maintainer:<user>`. */
	npmUser?: string | null;
	onProgress?: (progress: StatusProgress) => void;
};

/** Progress copy for the dashboard busy line. */
export function statusPhaseLabel(phase: StatusPhase, done?: number, total?: number): string {
	if (phase === 'globals') return 'checking global installs';
	const counted = total != null && total > 0 && done != null;
	if (phase === 'packages') {
		if (counted) return `reading packages (${done} of ${total})`;
		if (total != null && total > 0) return `reading ${total} packages`;
		return 'reading packages';
	}
	if (phase === 'npm') {
		return counted ? `checking npm (${done} of ${total})` : 'checking npm';
	}
	return counted ? `reading git (${done} of ${total})` : 'reading git';
}

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
	ship?: { dir: 'root' | 'site' };
};

export async function fleetStatus(loaded: LoadedManifest, options: StatusOptions = {}): Promise<FleetInventory> {
	if (options.refreshNpm || options.fetch) {
		clearNpmCache();
		clearGlobalCache();
	}
	const names = new Set<string>();
	const only = options.onlyIds?.length ? new Set(options.onlyIds) : null;
	const listed = loaded.manifest.projects.filter((project) => !only || only.has(project.id));
	const report = (phase: StatusPhase, done?: number, total?: number): void => {
		options.onProgress?.({ phase, label: statusPhaseLabel(phase, done, total), done, total });
	};
	if (options.gitOnly) {
		report('git', 0, listed.length);
		const gitOnlyRows = listed.map((project) => ({
			id: project.id,
			path: project.path,
			absPath: joinRoot(loaded.workspaceRoot, project.path),
			npm: project.npm,
		}));
		const gitPack = await mapPool(
			gitOnlyRows,
			GIT_POOL,
			async (row) => {
				const exists = await pathExists(row.absPath);
				return {
					exists,
					git: exists ? await readGitAsync(row.absPath, options.fetch === true) : EMPTY_GIT,
				};
			},
			(done, total) => report('git', done, total),
		);
		const projects: ProjectStatus[] = gitOnlyRows.map((row, index) => ({
			id: row.id,
			path: row.path,
			absPath: row.absPath,
			missing: !gitPack[index]?.exists,
			localVersion: null,
			private: false,
			npm: { name: row.npm, status: 'none' },
			git: gitPack[index]?.git ?? EMPTY_GIT,
			pins: [],
			cascadeBehind: 0,
			unpublishedAhead: false,
		}));
		return {
			workspaceRoot: loaded.workspaceRoot,
			manifestPath: loaded.manifestPath,
			digest: {
				projects: projects.length,
				dirty: projects.filter((p) => p.git.dirty).length,
				unpublishedAhead: 0,
				cascadeBehind: 0,
				missing: projects.filter((p) => p.missing).length,
				npmErrors: 0,
			},
			projects,
		};
	}
	report('packages', 0, listed.length);
	const prepared = await mapPool(
		listed,
		GIT_POOL,
		async (project): Promise<Prepared> => {
			const absPath = joinRoot(loaded.workspaceRoot, project.path);
			if (!(await pathExists(absPath))) {
				return {
					id: project.id,
					path: project.path,
					absPath,
					missing: true,
					privatePkg: false,
					localVersion: null,
					npmName: project.npm,
				};
			}
			const rootFile = rootPkgPath(absPath);
			const rootRead = (await pathExists(rootFile)) ? await readPkg(rootFile) : null;
			const rootError = rootRead && 'error' in rootRead ? rootRead.error : undefined;
			const rootPkg = rootRead && !('error' in rootRead) ? rootRead : undefined;
			let sitePkg: PkgJson | undefined;
			const siteFile = sitePkgPath(absPath);
			if (await pathExists(siteFile)) {
				const siteRead = await readPkg(siteFile);
				if (!('error' in siteRead)) sitePkg = siteRead;
			}
			return {
				id: project.id,
				path: project.path,
				absPath,
				missing: false,
				privatePkg: !!rootPkg?.private,
				localVersion: rootPkg?.version ?? null,
				npmName: project.npm ?? rootPkg?.name,
				rootPkg,
				rootError,
				sitePkg,
				ship: shipScriptTarget(rootPkg, sitePkg),
			};
		},
		(done, total) => report('packages', done, total),
	);
	for (const row of prepared) {
		if (row.npmName) names.add(row.npmName);
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

	const preferOnline = Boolean(options.refreshNpm || options.fetch);
	const needsGlobalRead = prepared.some((row) => pkgBinNames(row.rootPkg).length > 0);
	if (names.size) report('npm', 0, names.size);
	else report('git', 0, prepared.length);
	if (needsGlobalRead) report('globals');
	const [npmByName, gitCells, globals] = await Promise.all([
		names.size
			? npmLatestMany(names, undefined, (done, total) => report('npm', done, total), { preferOnline })
			: Promise.resolve(new Map<string, NpmCell>()),
		mapPool(
			prepared,
			GIT_POOL,
			async (row) => (row.missing ? EMPTY_GIT : readGitAsync(row.absPath, options.fetch === true)),
			(done, total) => report('git', done, total),
		),
		needsGlobalRead
			? Promise.resolve().then(() => readGlobalVersions(preferOnline))
			: Promise.resolve(new Map<string, string>()),
	]);
	const lifted = await mapPool(prepared, GIT_POOL, async (row) => {
		if (row.missing) return { name: row.npmName, status: 'none' } satisfies NpmCell;
		if (row.privatePkg) return { name: row.npmName, status: 'private' } satisfies NpmCell;
		if (!row.npmName) return { status: 'none' } satisfies NpmCell;
		const npm = npmByName.get(row.npmName) ?? { name: row.npmName, status: 'none' };
		if (!row.localVersion || npm.status !== 'ok') return npm;
		return liftLatestIfVersionExists(row.npmName, row.localVersion, npm, { preferOnline });
	});
	const latestByName = new Map<string, string>();
	for (const cell of [...npmByName.values(), ...lifted]) {
		if (cell.status === 'ok' && cell.latest && cell.name) latestByName.set(cell.name, cell.latest);
	}

	const projects: ProjectStatus[] = [];
	const sinceJobs: { absPath: string; version: string; branch?: string; status: ProjectStatus }[] = [];
	for (const [index, row] of prepared.entries()) {
		const git = gitCells[index] ?? EMPTY_GIT;
		if (row.missing) {
			projects.push({
				id: row.id,
				path: row.path,
				absPath: row.absPath,
				missing: true,
				localVersion: null,
				private: false,
				npm: { name: row.npmName, status: 'none' },
				git: EMPTY_GIT,
				pins: [],
				cascadeBehind: 0,
				unpublishedAhead: false,
			});
			continue;
		}

		const npm = lifted[index] ?? { status: 'none' };

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
			commitsSinceNpm: null,
			ship: row.ship,
			bin: pkgBinNames(row.rootPkg),
			global: row.npmName ? { version: globals.get(row.npmName) ?? null } : undefined,
		};
		if (row.rootError) status.error = row.rootError;
		projects.push(status);
		if (
			!options.skipCommitCounts &&
			!options.gitOnly &&
			needsCommitsSinceNpm(row, npm, unpublishedAhead, git) &&
			publishedVersion
		) {
			sinceJobs.push({ absPath: row.absPath, version: publishedVersion, branch: git.branch, status });
		}
	}

	if (sinceJobs.length) {
		await mapPool(sinceJobs, GIT_POOL, async (job) => {
			job.status.commitsSinceNpm = await countCommitsSinceVersion(job.absPath, job.version, job.branch);
		});
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
