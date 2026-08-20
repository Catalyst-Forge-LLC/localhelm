import path from 'node:path';
import type { LoadedManifest } from './manifest.js';
import { emptyManifest, writeManifest } from './manifest.js';
import { isDir, pathExists, readPkg, rootPkgPath } from './pkg.js';
import { manifestName, parentDir, relativeToRoot, resolveUserPath, slugId, toPosix } from './paths.js';
import type { EnrollPlan, FleetManifest, FleetProject } from './types.js';

export type EnrollRequest = {
	paths: string[];
	npm?: string;
	group?: string;
	cwd?: string;
	manifestPath?: string;
};

export function inferManifestPath(absPaths: string[], cwd: string): string {
	if (absPaths.length === 0) return toPosix(path.join(cwd, manifestName()));
	const parents = absPaths.map((p) => parentDir(p));
	if (parents.every((p) => p === parents[0])) {
		return toPosix(path.join(parents[0], manifestName()));
	}
	return toPosix(path.join(cwd, manifestName()));
}

function nextId(base: string, used: Set<string>): string {
	if (!used.has(base)) return base;
	let i = 2;
	while (used.has(`${base}-${i}`)) i += 1;
	return `${base}-${i}`;
}

export async function planEnroll(req: EnrollRequest, existing: LoadedManifest | null): Promise<EnrollPlan> {
	const cwd = req.cwd ?? process.cwd();
	const resolved = req.paths.map((raw) => resolveUserPath(raw, cwd));
	const manifestPath = toPosix(
		req.manifestPath ?? existing?.manifestPath ?? inferManifestPath(resolved, cwd),
	);
	const workspaceRoot = toPosix(path.dirname(manifestPath));
	const manifest: FleetManifest = existing?.manifest ?? emptyManifest();
	const usedIds = new Set(manifest.projects.map((p) => p.id));
	const usedPaths = new Set(manifest.projects.map((p) => p.path));
	const rows: EnrollPlan['rows'] = [];

	if (req.npm && req.paths.length !== 1) {
		throw new Error('--npm can only be used when enrolling a single path');
	}

	for (const raw of req.paths) {
		const abs = resolveUserPath(raw, cwd);
		if (!(await isDir(abs))) {
			rows.push({ action: 'skip', id: slugId(path.basename(abs)), path: raw, reason: `not a directory: ${abs}` });
			continue;
		}
		let rel: string;
		try {
			rel = relativeToRoot(abs, workspaceRoot);
		} catch (err) {
			rows.push({
				action: 'skip',
				id: slugId(path.basename(abs)),
				path: raw,
				reason: err instanceof Error ? err.message : String(err),
			});
			continue;
		}
		if (usedPaths.has(rel)) {
			const already = manifest.projects.find((p) => p.path === rel);
			rows.push({
				action: 'skip',
				id: already?.id ?? slugId(path.basename(abs)),
				path: rel,
				npm: already?.npm,
				reason: 'already enrolled',
			});
			continue;
		}
		const pkg = (await pathExists(rootPkgPath(abs))) ? await readPkg(rootPkgPath(abs)) : null;
		const npm = req.npm ?? (pkg && !('error' in pkg) ? pkg.name : undefined);
		const id = nextId(slugId(path.basename(abs)), usedIds);
		usedIds.add(id);
		usedPaths.add(rel);
		rows.push({ action: 'add', id, path: rel, npm, group: req.group });
	}

	return { manifestPath, rows, writes: false };
}

export async function applyEnroll(plan: EnrollPlan, existing: LoadedManifest | null): Promise<FleetManifest> {
	const manifest: FleetManifest = existing?.manifest
		? { ...existing.manifest, projects: [...existing.manifest.projects] }
		: emptyManifest();
	for (const row of plan.rows) {
		if (row.action !== 'add') continue;
		const project: FleetProject = { id: row.id, path: row.path };
		if (row.npm) project.npm = row.npm;
		if (row.group) project.group = row.group;
		manifest.projects.push(project);
	}
	await writeManifest(plan.manifestPath, manifest);
	return manifest;
}

export async function planUnenroll(ids: string[], loaded: LoadedManifest): Promise<EnrollPlan> {
	const rows: EnrollPlan['rows'] = ids.map((id) => {
		const hit = loaded.manifest.projects.find((p) => p.id === id);
		if (!hit) return { action: 'skip' as const, id, path: '', reason: `not enrolled: ${id}` };
		return { action: 'update' as const, id, path: hit.path, npm: hit.npm, reason: 'remove' };
	});
	return { manifestPath: loaded.manifestPath, rows, writes: false };
}

export async function applyUnenroll(plan: EnrollPlan, loaded: LoadedManifest): Promise<FleetManifest> {
	const remove = new Set(plan.rows.filter((r) => r.action === 'update').map((r) => r.id));
	const manifest: FleetManifest = {
		...loaded.manifest,
		projects: loaded.manifest.projects.filter((p) => !remove.has(p.id)),
	};
	await writeManifest(plan.manifestPath, manifest);
	return manifest;
}

export function defaultManifestPath(cwd = process.cwd()): string {
	return toPosix(path.join(cwd, manifestName()));
}
