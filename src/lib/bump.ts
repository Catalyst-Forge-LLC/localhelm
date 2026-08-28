import { readFile, writeFile } from 'node:fs/promises';
import { commitPaths, helmBumpMessage } from './commit.js';
import { listFactsFiles, rewriteFactsVersion } from './factsVersion.js';
import { readGit } from './git.js';
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
	repo?: string;
	commit?: 'commit' | 'skip';
	commitMessage?: string;
	commitReason?: string;
};

function commitIntent(abs: string, pkg: string, to: string): Pick<BumpPlan, 'commit' | 'commitMessage' | 'commitReason'> {
	const git = readGit(abs);
	if (!git.repo) return { commit: 'skip', commitReason: 'no git' };
	if (git.detached) return { commit: 'skip', commitReason: 'detached' };
	if (git.busy) return { commit: 'skip', commitReason: git.busy };
	if (git.error) return { commit: 'skip', commitReason: git.error };
	return { commit: 'commit', commitMessage: helmBumpMessage(pkg, to) };
}

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
		const pkg = project.npm ?? id;
		return { id, file, from: match[1], to, action: 'bump', repo: abs, ...commitIntent(abs, pkg, to) };
	} catch (err) {
		return { id, file, from: match[1], to: null, action: 'skip', reason: err instanceof Error ? err.message : String(err) };
	}
}

export async function applyBump(plan: BumpPlan): Promise<string[]> {
	if (plan.action !== 'bump' || !plan.to || !plan.from) {
		throw new Error(plan.reason ?? `cannot apply bump for ${plan.id}`);
	}
	const raw = await readFile(plan.file, 'utf8');
	const next = raw.replace(/"version"\s*:\s*"([^"]*)"/, `"version": "${plan.to}"`);
	if (next === raw) throw new Error(`did not replace version in ${plan.file}`);
	await writeFile(plan.file, next, 'utf8');
	const files = [plan.file];
	const scanRoot = plan.repo ?? plan.file.replace(/[/\\]package\.json$/i, '');
	for (const facts of await listFactsFiles(scanRoot)) {
		const factsRaw = await readFile(facts, 'utf8');
		const factsNext = rewriteFactsVersion(factsRaw, plan.from, plan.to);
		if (!factsNext) continue;
		await writeFile(facts, factsNext, 'utf8');
		files.push(facts);
	}
	if (plan.commit === 'commit' && plan.commitMessage && plan.repo) {
		const committed = commitPaths(plan.repo, files, plan.commitMessage);
		if (!committed.ok) {
			throw new Error(`wrote ${plan.to} but commit failed: ${committed.error}`);
		}
	}
	return files;
}
