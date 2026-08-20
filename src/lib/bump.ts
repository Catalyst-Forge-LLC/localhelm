import { readFile, writeFile } from 'node:fs/promises';
import type { LoadedManifest } from './manifest.js';
import { joinRoot } from './paths.js';
import { pathExists, rootPkgPath } from './pkg.js';
import { bumpTriple, type BumpKind } from './semver.js';

export type BumpPlan = {
	id: string;
	file: string;
	from: string | null;
	to: string | null;
	action: 'bump' | 'skip';
	reason?: string;
};

export async function planBump(loaded: LoadedManifest, id: string, kind: BumpKind): Promise<BumpPlan> {
	const project = loaded.manifest.projects.find((p) => p.id === id);
	if (!project) return { id, file: '', from: null, to: null, action: 'skip', reason: `not enrolled: ${id}` };
	const abs = joinRoot(loaded.workspaceRoot, project.path);
	const file = rootPkgPath(abs);
	if (!(await pathExists(file))) {
		return { id, file, from: null, to: null, action: 'skip', reason: `no package.json at ${file}` };
	}
	const raw = await readFile(file, 'utf8');
	const match = /"version"\s*:\s*"([^"]*)"/.exec(raw);
	if (!match) return { id, file, from: null, to: null, action: 'skip', reason: 'no version field' };
	try {
		const to = bumpTriple(match[1], kind);
		return { id, file, from: match[1], to, action: 'bump' };
	} catch (err) {
		return { id, file, from: match[1], to: null, action: 'skip', reason: err instanceof Error ? err.message : String(err) };
	}
}

export async function applyBump(plan: BumpPlan): Promise<void> {
	if (plan.action !== 'bump' || !plan.to || !plan.from) {
		throw new Error(plan.reason ?? `cannot apply bump for ${plan.id}`);
	}
	const raw = await readFile(plan.file, 'utf8');
	const next = raw.replace(/"version"\s*:\s*"[^"]*"/, `"version": "${plan.to}"`);
	if (next === raw) throw new Error(`did not replace version in ${plan.file}`);
	await writeFile(plan.file, next, 'utf8');
}
