import { spawn, spawnSync } from 'node:child_process';
import { applyBump, planBump } from './bump.js';
import { commitPaths, helmBumpMessage } from './commit.js';
import { applyPush, readGit, type GitJobRow } from './git.js';
import type { LoadedManifest } from './manifest.js';
import { joinRoot } from './paths.js';
import { rootPkgPath } from './pkg.js';
import { bumpTriple, compareSemver, type BumpKind } from './semver.js';
import { fleetStatus } from './status.js';
import type { FleetInventory, ProjectStatus } from './types.js';

export type PublishStep =
	| { kind: 'bump'; from: string; to: string; bumpKind: BumpKind }
	| { kind: 'commit'; message: string }
	| { kind: 'push'; branch: string; origin: string }
	| { kind: 'publish'; name: string; version: string };

export type PublishRow = {
	id: string;
	path: string;
	npm?: string;
	version: string | null;
	action: 'publish' | 'skip';
	reason?: string;
	steps: PublishStep[];
	stdout?: string;
	stderr?: string;
};

export type PublishResult = { ok: boolean; stdout: string; stderr: string };
export type PublishRunner = (cwd: string, args: string[]) => PublishResult | Promise<PublishResult>;

export const NPM_PUBLISH_AUTH_HINT =
	'LocalHelm opens the npm login URL in your browser. Finish LastPass / passkey there. An npm automation token in your user .npmrc skips this. LocalHelm never types a password.';

const NPM_AUTH_URL = /https:\/\/www\.npmjs\.com\/auth\/cli\/[0-9a-f-]+/i;

export function extractNpmAuthUrl(text: string): string | null {
	const match = NPM_AUTH_URL.exec(text);
	return match?.[0] ?? null;
}

export function openInBrowser(url: string): void {
	if (process.platform === 'win32') {
		spawn('cmd.exe', ['/c', 'start', '', url], { detached: true, stdio: 'ignore' }).unref();
		return;
	}
	if (process.platform === 'darwin') {
		spawn('open', [url], { detached: true, stdio: 'ignore' }).unref();
		return;
	}
	spawn('xdg-open', [url], { detached: true, stdio: 'ignore' }).unref();
}

export function npmWhoami(): string | null {
	const result = spawnSync(process.platform === 'win32' ? 'npm.cmd' : 'npm', ['whoami'], {
		encoding: 'utf8',
		windowsHide: true,
		timeout: 15_000,
	});
	if (result.status !== 0) return null;
	const user = (result.stdout ?? '').trim();
	return user || null;
}

export function requirePublishIds(ids: string[]): string[] {
	const named = ids.map((id) => id.trim()).filter((id) => id.length > 0);
	if (named.length === 0) {
		throw new Error('name the project id(s) to publish. LocalHelm will not publish the whole fleet in one apply.');
	}
	return named;
}

export function defaultPublishRunner(cwd: string, args: string[]): Promise<PublishResult> {
	if (args.includes('--force') || args.includes('-f')) {
		return Promise.resolve({ ok: false, stdout: '', stderr: 'localhelm never passes --force to npm publish' });
	}
	const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
	return new Promise((resolve) => {
		const child = spawn(npm, args, {
			cwd,
			stdio: ['pipe', 'pipe', 'pipe'],
			windowsHide: true,
		});
		let stdout = '';
		let stderr = '';
		let opened = false;
		const timer = setTimeout(() => {
			child.kill();
			resolve({ ok: false, stdout, stderr: stderr || 'npm publish timed out waiting for login' });
		}, 600_000);

		const onChunk = (chunk: Buffer | string, sink: 'stdout' | 'stderr'): void => {
			const text = String(chunk);
			if (sink === 'stdout') stdout += text;
			else stderr += text;
			try {
				process.stdout.write(text);
			} catch {
				/* parent may have no TTY */
			}
			if (opened) return;
			const url = extractNpmAuthUrl(stdout + stderr);
			if (!url) return;
			opened = true;
			openInBrowser(url);
			try {
				child.stdin.write('\n');
			} catch {
				/* npm may have closed stdin */
			}
		};

		child.stdout.on('data', (chunk: Buffer) => onChunk(chunk, 'stdout'));
		child.stderr.on('data', (chunk: Buffer) => onChunk(chunk, 'stderr'));
		child.on('error', (err) => {
			clearTimeout(timer);
			resolve({ ok: false, stdout, stderr: err.message });
		});
		child.on('close', (code) => {
			clearTimeout(timer);
			if (code === 0) resolve({ ok: true, stdout, stderr });
			else resolve({ ok: false, stdout, stderr: stderr.trim() || `npm publish exited ${code}` });
		});
	});
}

function summarize(steps: PublishStep[]): string {
	return steps
		.map((step) => {
			if (step.kind === 'bump') return `bump ${step.from}→${step.to}`;
			if (step.kind === 'commit') return 'commit';
			if (step.kind === 'push') return `push ${step.branch}`;
			return `npm publish ${step.name}@${step.version}`;
		})
		.join(' · ');
}

function planPublishOne(row: ProjectStatus, kind: BumpKind): PublishRow {
	const base: PublishRow = {
		id: row.id,
		path: row.path,
		npm: row.npm.name,
		version: row.localVersion,
		action: 'skip',
		steps: [],
	};
	if (row.missing) return { ...base, reason: 'folder missing' };
	if (row.private) return { ...base, reason: 'private' };
	if (row.error) return { ...base, reason: row.error };
	if (!row.npm.name) return { ...base, reason: 'no npm package name' };
	if (!row.localVersion) return { ...base, reason: 'no local version' };
	if (row.npm.status === 'error') return { ...base, reason: row.npm.error ?? 'npm lookup failed' };
	if (row.npm.status === 'private') return { ...base, reason: 'private' };
	if (!row.git.repo) return { ...base, reason: 'not a git repo' };
	if (row.git.busy) return { ...base, reason: `mid-${row.git.busy}` };
	if (row.git.detached) return { ...base, reason: 'detached' };
	if (row.git.dirty) return { ...base, reason: 'dirty' };

	const neverPublished = row.npm.status === 'none';
	if (!neverPublished && row.npm.latest) {
		const cmp = compareSemver(row.localVersion, row.npm.latest);
		if (cmp !== null && cmp < 0) return { ...base, reason: 'local is behind npm' };
	}

	const steps: PublishStep[] = [];
	let version = row.localVersion;
	const needsBump = !neverPublished && !row.unpublishedAhead;
	if (needsBump) {
		let to: string;
		try {
			to = bumpTriple(row.localVersion, kind);
		} catch (err) {
			return { ...base, reason: err instanceof Error ? err.message : String(err) };
		}
		steps.push({ kind: 'bump', from: row.localVersion, to, bumpKind: kind });
		steps.push({ kind: 'commit', message: helmBumpMessage(row.npm.name, to) });
		version = to;
	}

	const needsPush = needsBump || (row.git.ahead ?? 0) > 0;
	if (needsPush) {
		if (!row.git.origin) return { ...base, reason: 'no origin' };
		if (!row.git.branch) return { ...base, reason: 'no branch' };
		if (row.git.ahead == null || row.git.behind == null) return { ...base, reason: 'no upstream' };
		if (row.git.behind > 0) return { ...base, reason: 'diverged' };
		steps.push({ kind: 'push', branch: row.git.branch, origin: row.git.origin });
	}

	steps.push({ kind: 'publish', name: row.npm.name, version });
	return {
		...base,
		action: 'publish',
		version,
		steps,
		reason: summarize(steps),
	};
}

export function planPublishFromInventory(
	inventory: FleetInventory,
	onlyIds: string[] | undefined,
	kind: BumpKind,
): PublishRow[] {
	if (onlyIds?.length) {
		return onlyIds.map((id) => {
			const row = inventory.projects.find((p) => p.id === id);
			if (!row) return { id, path: '', version: null, action: 'skip', reason: 'not enrolled', steps: [] };
			return planPublishOne(row, kind);
		});
	}
	return inventory.projects.map((row) => planPublishOne(row, kind));
}

export async function planPublish(
	loaded: LoadedManifest,
	onlyIds: string[] | undefined,
	kind: BumpKind = 'patch',
): Promise<PublishRow[]> {
	const inventory = await fleetStatus(loaded);
	return planPublishFromInventory(inventory, onlyIds, kind);
}

export async function applyPublish(
	loaded: LoadedManifest,
	row: PublishRow,
	opts: { otp?: string; run?: PublishRunner } = {},
): Promise<PublishRow> {
	if (row.action !== 'publish') return row;
	const project = loaded.manifest.projects.find((p) => p.id === row.id);
	if (!project) return { ...row, action: 'skip', reason: 'not enrolled' };
	const abs = joinRoot(loaded.workspaceRoot, project.path);

	for (const step of row.steps) {
		if (step.kind === 'bump') {
			const bump = await planBump(loaded, row.id, step.bumpKind);
			if (bump.action !== 'bump' || bump.to !== step.to) {
				return { ...row, action: 'skip', reason: bump.reason ?? `bump drifted (planned ${step.to})` };
			}
			await applyBump(bump);
		} else if (step.kind === 'commit') {
			const file = rootPkgPath(abs);
			const committed = commitPaths(abs, [file], step.message);
			if (!committed.ok) {
				return { ...row, reason: `commit: ${committed.error}` };
			}
		} else if (step.kind === 'push') {
			const git = readGit(abs);
			const pushRow: GitJobRow = {
				id: row.id,
				path: project.path,
				action: 'push',
				branch: git.branch ?? step.branch,
				origin: git.origin ?? step.origin,
			};
			const pushed = applyPush(loaded.workspaceRoot, pushRow);
			if (pushed.reason !== 'pushed') {
				return { ...row, reason: `push: ${pushed.reason ?? pushed.stderr}` };
			}
		} else if (step.kind === 'publish') {
			const args = ['publish', '--access', 'public'];
			if (opts.otp) args.push('--otp', opts.otp);
			const run = opts.run ?? defaultPublishRunner;
			const result = await Promise.resolve(run(abs, args));
			if (!result.ok) {
				return {
					...row,
					stdout: result.stdout.trim() || undefined,
					stderr: result.stderr,
					reason: result.stderr || 'npm publish failed',
				};
			}
			return {
				...row,
				stdout: result.stdout.trim() || undefined,
				stderr: result.stderr.trim() || undefined,
				reason: `published ${step.name}@${step.version}`,
			};
		}
	}
	return { ...row, reason: 'no publish step' };
}
