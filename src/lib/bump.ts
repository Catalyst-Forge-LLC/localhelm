import { readFile, writeFile } from 'node:fs/promises';
import { commitPaths, helmBumpMessage, isGitIgnored } from './commit.js';
import { listFactsFiles, rewriteFactsVersion } from './factsVersion.js';
import { readGit } from './git.js';
import type { LoadedManifest } from './manifest.js';
import { joinRoot } from './paths.js';
import { pathExists, rootPkgPath } from './pkg.js';
import { bumpTriple, type BumpKind } from './semver.js';
import { readReleaseTarget } from './releaseTarget.js';

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

/** Preserve formatting and nested metadata; only replace the authoritative top-level version. */
function versionRange(raw: string): { start: number; end: number; value: string } | undefined {
	JSON.parse(raw);
	let depth = 0;
	let found: { start: number; end: number; value: string } | undefined;
	for (let i = 0; i < raw.length; i++) {
		if (raw[i] === '"') {
			let end = i + 1;
			for (; end < raw.length; end++) { if (raw[end] === '\\') end++; else if (raw[end] === '"') break; }
			const colon = /^\s*:\s*/.exec(raw.slice(end + 1));
			if (depth === 1 && colon && JSON.parse(raw.slice(i, end + 1)) === 'version') {
				if (found) throw new Error('Duplicate top-level version fields. Resolve them before bumping.');
				const start = end + 1 + colon[0].length;
				const literal = /^"(?:[^"\\]|\\.)*"/.exec(raw.slice(start));
				if (!literal) throw new Error('Version must be a string.');
				found = { start, end: start + literal[0].length, value: JSON.parse(literal[0]) as string };
			}
			i = end;
		} else if (raw[i] === '{' || raw[i] === '[') depth++;
		else if (raw[i] === '}' || raw[i] === ']') depth--;
	}
	return found;
}

export async function planBump(loaded: LoadedManifest, id: string, kind: BumpKind): Promise<BumpPlan> {
	const project = loaded.manifest.projects.find((p) => p.id === id);
	if (!project) return { id, file: '', from: null, to: null, action: 'skip', reason: `not enrolled: ${id}` };
	const abs = joinRoot(loaded.workspaceRoot, project.path);
	let file = rootPkgPath(abs);
	try { file = (await readReleaseTarget(abs))?.target.manifest ?? file; }
	catch (err) { return { id, file, from: null, to: null, action: 'skip', reason: (err as Error).message }; }
	if (!(await pathExists(file))) {
		return { id, file, from: null, to: null, action: 'skip', reason: `no package.json at ${file}` };
	}
	const raw = await readFile(file, 'utf8');
	let range: ReturnType<typeof versionRange>;
	try { range = versionRange(raw); }
	catch (err) { return { id, file, from: null, to: null, action: 'skip', reason: (err as Error).message }; }
	if (!range) return { id, file, from: null, to: null, action: 'skip', reason: 'no version field' };
	try {
		const to = bumpTriple(range.value, kind);
		const pkg = project.npm ?? id;
		return { id, file, from: range.value, to, action: 'bump', repo: abs, ...commitIntent(abs, pkg, to) };
	} catch (err) {
		return { id, file, from: range.value, to: null, action: 'skip', reason: err instanceof Error ? err.message : String(err) };
	}
}

export async function applyBump(plan: BumpPlan): Promise<string[]> {
	if (plan.action !== 'bump' || !plan.to || !plan.from) {
		throw new Error(plan.reason ?? `cannot apply bump for ${plan.id}`);
	}
	const raw = await readFile(plan.file, 'utf8');
	const range = versionRange(raw);
	if (range?.value !== plan.from) throw new Error('Version changed after planning. Refresh and open a new Bump plan.');
	const next = raw.slice(0, range.start) + JSON.stringify(plan.to) + raw.slice(range.end);
	if (next === raw) throw new Error(`did not replace version in ${plan.file}`);
	await writeFile(plan.file, next, 'utf8');
	const files = [plan.file];
	const scanRoot = plan.repo ?? plan.file.replace(/[/\\]package\.json$/i, '');
	for (const facts of await listFactsFiles(scanRoot)) {
		// FilePress copies skills into site/build and site/static/skills (gitignored).
		if (plan.repo && isGitIgnored(plan.repo, facts)) continue;
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
