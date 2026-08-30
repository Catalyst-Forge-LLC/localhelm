import { spawn, spawnSync } from 'node:child_process';
import { applyBump, planBump } from './bump.js';
import { commitPaths, helmBumpMessage } from './commit.js';
import { applyPush, readGit, type GitJobRow } from './git.js';
import type { LoadedManifest } from './manifest.js';
import { joinRoot } from './paths.js';
import { rootPkgPath } from './pkg.js';
import { bumpTriple, type BumpKind } from './semver.js';
import { detectGithubPublish } from './githubPublish.js';
import { fleetStatus } from './status.js';
import type { FleetInventory, ProjectStatus } from './types.js';
import { plainPublishError, whyNotPublish } from './writeGate.js';

export type { PublishStep } from './publishTypes.js';
import type { PublishStep } from './publishTypes.js';
export { publishStepLabel } from './publishDisplay.js';

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
export type PublishStepEvent = {
	id: string;
	index: number;
	kind: PublishStep['kind'];
	status: 'start' | 'done' | 'fail';
};

export const NPM_PUBLISH_AUTH_HINT =
	'Run localhelm auth and put a granular automation token (Bypass 2FA) in your user ~/.npmrc before you publish. LocalHelm never stores the token.';

/** Setup copy only when whoami failed. A working user token is already in ~/.npmrc. */
export function publishAuthHintFor(npmUser: string | null | undefined): string | undefined {
	return npmUser ? undefined : NPM_PUBLISH_AUTH_HINT;
}

const NPM_AUTH_URL = /https:\/\/www\.npmjs\.com\/auth\/cli\/[0-9a-f-]+/i;

export function extractNpmAuthUrl(text: string): string | null {
	const match = NPM_AUTH_URL.exec(text);
	return match?.[0] ?? null;
}

export function openInBrowser(url: string): void {
	if (process.platform === 'win32') {
		spawn('explorer.exe', [url], { detached: true, stdio: 'ignore' }).unref();
		return;
	}
	if (process.platform === 'darwin') {
		spawn('open', [url], { detached: true, stdio: 'ignore' }).unref();
		return;
	}
	spawn('xdg-open', [url], { detached: true, stdio: 'ignore' }).unref();
}

export function npmWhoami(): string | null {
	const win = process.platform === 'win32';
	const result = spawnSync(win ? 'npm.cmd' : 'npm', ['whoami'], {
		encoding: 'utf8',
		windowsHide: true,
		shell: win,
		timeout: 15_000,
	});
	if (result.error || result.status !== 0) return null;
	const user = (result.stdout ?? '')
		.trim()
		.split(/\r?\n/)
		.map((line) => line.trim())
		.find((line) => line.length > 0 && !line.startsWith('npm '));
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
	const win = process.platform === 'win32';
	const npm = win ? 'npm.cmd' : 'npm';
	return new Promise((resolve) => {
		const child = spawn(npm, args, {
			cwd,
			stdio: ['pipe', 'pipe', 'pipe'],
			windowsHide: true,
			shell: win,
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
			if (step.kind === 'github') return `GitHub Publish ${step.name}@${step.version}`;
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
	const blocked = whyNotPublish(row, kind);
	if (blocked) return { ...base, reason: blocked };

	const localVersion = row.localVersion;
	const npmName = row.npm.name;
	if (!localVersion || !npmName) {
		return { ...base, reason: !npmName ? 'no npm package name' : 'no local version' };
	}

	const neverPublished = row.npm.status === 'none';

	const steps: PublishStep[] = [];
	let version = localVersion;
	const needsBump = !neverPublished && !row.unpublishedAhead;
	if (needsBump) {
		let to: string;
		try {
			to = bumpTriple(localVersion, kind);
		} catch (err) {
			return { ...base, reason: err instanceof Error ? err.message : String(err) };
		}
		steps.push({ kind: 'bump', from: localVersion, to, bumpKind: kind });
		steps.push({ kind: 'commit', message: helmBumpMessage(npmName, to) });
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

	const github = detectGithubPublish(row.absPath, row.git.origin);
	if (github) {
		steps.push({
			kind: 'github',
			name: npmName,
			version,
			url: github.url,
			workflow: github.file,
		});
	} else {
		steps.push({ kind: 'publish', name: npmName, version });
	}
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
	opts: { otp?: string; run?: PublishRunner; onStep?: (event: PublishStepEvent) => void } = {},
): Promise<PublishRow> {
	if (row.action !== 'publish') return row;
	const project = loaded.manifest.projects.find((p) => p.id === row.id);
	if (!project) return { ...row, action: 'skip', reason: 'not enrolled' };
	const abs = joinRoot(loaded.workspaceRoot, project.path);

	const emit = (index: number, kind: PublishStep['kind'], status: PublishStepEvent['status']): void => {
		opts.onStep?.({ id: row.id, index, kind, status });
	};

	let bumpFiles: string[] = [];
	for (let index = 0; index < row.steps.length; index++) {
		const step = row.steps[index];
		if (!step) continue;
		emit(index, step.kind, 'start');
		if (step.kind === 'bump') {
			const bump = await planBump(loaded, row.id, step.bumpKind);
			if (bump.action !== 'bump' || bump.to !== step.to) {
				emit(index, step.kind, 'fail');
				return { ...row, action: 'skip', reason: bump.reason ?? `bump drifted (planned ${step.to})` };
			}
			bumpFiles = await applyBump({ ...bump, commit: 'skip' });
		} else if (step.kind === 'commit') {
			const files = bumpFiles.length > 0 ? bumpFiles : [rootPkgPath(abs)];
			const committed = commitPaths(abs, files, step.message);
			if (!committed.ok) {
				emit(index, step.kind, 'fail');
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
				emit(index, step.kind, 'fail');
				return { ...row, reason: `push: ${pushed.reason ?? pushed.stderr}` };
			}
		} else if (step.kind === 'github') {
			emit(index, step.kind, 'done');
			return {
				...row,
				stdout: step.url,
				reason: `open GitHub Publish ${step.name}@${step.version}  ${step.url}`,
			};
		} else if (step.kind === 'publish') {
			const args = ['publish', '--access', 'public'];
			if (opts.otp) args.push('--otp', opts.otp);
			const run = opts.run ?? defaultPublishRunner;
			const result = await Promise.resolve(run(abs, args));
			if (!result.ok) {
				emit(index, step.kind, 'fail');
				const stderr = result.stderr.trim();
				return {
					...row,
					stdout: result.stdout.trim() || undefined,
					stderr: stderr || undefined,
					reason: plainPublishError(stderr || 'npm publish failed'),
				};
			}
			emit(index, step.kind, 'done');
			return {
				...row,
				stdout: result.stdout.trim() || undefined,
				stderr: result.stderr.trim() || undefined,
				reason: `published ${step.name}@${step.version}`,
			};
		}
		emit(index, step.kind, 'done');
	}
	return { ...row, reason: 'no publish step' };
}
