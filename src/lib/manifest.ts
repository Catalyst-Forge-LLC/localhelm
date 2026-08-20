import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { FleetManifest, FleetProject } from './types.js';
import {
	isDir,
	pathExists,
} from './pkg.js';
import {
	joinRoot,
	manifestName,
	resolveUserPath,
	toPosix,
	userGlobalManifestPath,
} from './paths.js';

export type LoadedManifest = {
	manifest: FleetManifest;
	manifestPath: string;
	workspaceRoot: string;
};

export function emptyManifest(): FleetManifest {
	return { workspaceRoot: '.', projects: [] };
}

export function validateManifest(raw: unknown, filePath: string): FleetManifest {
	if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
		throw new Error(`manifest is not an object: ${filePath}`);
	}
	const body = raw as Record<string, unknown>;
	const workspaceRoot = body.workspaceRoot;
	if (workspaceRoot !== undefined && workspaceRoot !== '.') {
		throw new Error(`workspaceRoot must be "." (got ${JSON.stringify(workspaceRoot)}) in ${filePath}`);
	}
	const projects = body.projects;
	if (!Array.isArray(projects)) {
		throw new Error(`manifest.projects must be an array: ${filePath}`);
	}
	const ids = new Set<string>();
	const paths = new Set<string>();
	const list: FleetProject[] = [];
	for (const item of projects) {
		if (!item || typeof item !== 'object') {
			throw new Error(`invalid project row in ${filePath}`);
		}
		const row = item as Record<string, unknown>;
		if (typeof row.id !== 'string' || !row.id.trim()) {
			throw new Error(`project missing id in ${filePath}`);
		}
		if (typeof row.path !== 'string' || !row.path.trim()) {
			throw new Error(`project ${row.id} missing path in ${filePath}`);
		}
		if (ids.has(row.id)) throw new Error(`duplicate id "${row.id}" in ${filePath}`);
		const normPath = toPosix(row.path);
		if (paths.has(normPath)) throw new Error(`duplicate path "${normPath}" in ${filePath}`);
		ids.add(row.id);
		paths.add(normPath);
		list.push({
			id: row.id,
			path: normPath,
			...(typeof row.npm === 'string' ? { npm: row.npm } : {}),
			...(typeof row.group === 'string' ? { group: row.group } : {}),
		});
	}
	return {
		...(typeof body.$schema === 'string' ? { $schema: body.$schema } : {}),
		workspaceRoot: '.',
		projects: list,
	};
}

export async function readManifestFile(filePath: string): Promise<LoadedManifest> {
	const raw = await readFile(filePath, 'utf8');
	const manifest = validateManifest(JSON.parse(raw) as unknown, filePath);
	const workspaceRoot = toPosix(path.dirname(filePath));
	return { manifest, manifestPath: toPosix(filePath), workspaceRoot };
}

export async function findManifest(cwd = process.cwd()): Promise<LoadedManifest | null> {
	let dir = resolveUserPath(cwd);
	for (;;) {
		const candidate = toPosix(path.join(dir, manifestName()));
		if (await pathExists(candidate)) return readManifestFile(candidate);
		const parent = toPosix(path.dirname(dir));
		if (parent === dir) break;
		dir = parent;
	}
	const globalPath = userGlobalManifestPath();
	if (await pathExists(globalPath)) return readManifestFile(globalPath);
	return null;
}

export async function requireManifest(cwd = process.cwd()): Promise<LoadedManifest> {
	const found = await findManifest(cwd);
	if (!found) {
		throw new Error(
			`no ${manifestName()} found from ${cwd} (and no ~/.localhelm/fleet.json). Scan folders, then enroll --apply.`,
		);
	}
	return found;
}

export async function writeManifest(filePath: string, manifest: FleetManifest): Promise<void> {
	validateManifest(manifest, filePath);
	await mkdir(path.dirname(filePath), { recursive: true });
	const body = `${JSON.stringify(manifest, null, 2)}\n`;
	await writeFile(filePath, body, 'utf8');
}

export async function projectAbsPath(loaded: LoadedManifest, project: FleetProject): Promise<string> {
	return joinRoot(loaded.workspaceRoot, project.path);
}

export async function assertWorkspaceDir(dir: string): Promise<void> {
	if (!(await isDir(dir))) {
		throw new Error(`not a directory: ${dir}`);
	}
}
