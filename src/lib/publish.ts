import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import path from 'node:path';
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
import { plainCommitError, plainPublishError, whyNotPublish } from './writeGate.js';
import { npmInvocation } from './npmCommand.js';
import { readReleaseTarget } from './releaseTarget.js';
import { assertReleaseArchive, assertReleaseTree, prepareRelease, runReleaseCommand } from './releasePrepare.js';
import { readPkg } from './pkg.js';
import type { ReleaseArtifact } from './releaseTypes.js';

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
	/** The local npm command packs this enrolled directory. GitHub workflows own their own target. */
	package?: { directory: string; executables: string[]; manifest?: string; readme?: string; buildScript?: string; revision?: string };
	revision?: string;
	artifact?: ReleaseArtifact;
	warning?: string;
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
	artifact?: ReleaseArtifact;
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

export { npmWhoami } from './npm.js';

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
	const invocation = npmInvocation(args);
	return new Promise((resolve) => {
		const child = spawn(invocation.command, invocation.args, {
			cwd,
			stdio: ['pipe', 'pipe', 'pipe'],
			windowsHide: true,
			shell: false,
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
			if (step.kind === 'pack') return 'pack + verify';
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
		package: { directory: row.release?.directory ?? row.absPath, executables: row.release?.executables ?? row.bin ?? [], ...(row.release ? { manifest: row.release.manifest, readme: row.release.readme, buildScript: row.release.buildScript, revision: row.release.revision } : {}) },
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

	const github = detectGithubPublish(row.absPath, row.git.origin);
	if (!github) steps.push({ kind: 'pack', name: npmName, version });
	const needsPush = needsBump || (row.git.ahead ?? 0) > 0;
	if (needsPush) {
		if (!row.git.origin) return { ...base, reason: 'no origin' };
		if (!row.git.branch) return { ...base, reason: 'no branch' };
		if (row.git.ahead == null || row.git.behind == null) return { ...base, reason: 'no upstream' };
		if (row.git.behind > 0) return { ...base, reason: 'diverged' };
		steps.push({ kind: 'push', branch: row.git.branch, origin: row.git.origin });
	}

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
		revision: createHash('sha256').update(JSON.stringify({ release: row.release?.revision, path: row.absPath, name: npmName, version, steps })).digest('hex'),
		reason: summarize(steps),
	};
}

export function planPublishFromInventory(
	inventory: FleetInventory,
	onlyIds: string[] | undefined,
	kind: BumpKind | Record<string, BumpKind>,
): PublishRow[] {
	if (onlyIds?.length) {
		return onlyIds.map((id) => {
			const row = inventory.projects.find((p) => p.id === id);
			if (!row) return { id, path: '', version: null, action: 'skip', reason: 'not enrolled', steps: [] };
			return planPublishOne(row, typeof kind === 'string' ? kind : kind[row.id] ?? 'patch');
		});
	}
	return inventory.projects.map((row) => planPublishOne(row, typeof kind === 'string' ? kind : kind[row.id] ?? 'patch'));
}

export async function planPublish(
	loaded: LoadedManifest,
	onlyIds: string[] | undefined,
	kind: BumpKind | Record<string, BumpKind> = 'patch',
): Promise<PublishRow[]> {
	const inventory = await fleetStatus(loaded);
	return planPublishFromInventory(inventory, onlyIds, kind);
}

export async function applyPublish(
	loaded: LoadedManifest,
	row: PublishRow,
	opts: { otp?: string; run?: PublishRunner; packRun?: PublishRunner; onStep?: (event: PublishStepEvent) => void } = {},
): Promise<PublishRow> {
	if (row.action !== 'publish') return row;
	const project = loaded.manifest.projects.find((p) => p.id === row.id);
	if (!project) return { ...row, action: 'skip', reason: 'not enrolled' };
	const abs = joinRoot(loaded.workspaceRoot, project.path);

	const emit = (index: number, kind: PublishStep['kind'], status: PublishStepEvent['status'], artifact?: ReleaseArtifact): void => {
		opts.onStep?.({ id: row.id, index, kind, status, ...(artifact ? { artifact } : {}) });
	};

	let bumpFiles: string[] = [];
	let prepared: Awaited<ReturnType<typeof prepareRelease>> | undefined;
	const command = opts.packRun ?? defaultPublishRunner;
	const initial = await readReleaseTarget(abs);
	if (!initial || initial.pkg.private || (row.package?.revision && initial.target.revision !== row.package.revision)) return { ...row, action: 'skip', reason: 'Release source changed or is private. Refresh and open a new Publish plan.' };
	for (let index = 0; index < row.steps.length; index++) {
		const step = row.steps[index];
		if (!step) continue;
		emit(index, step.kind, 'start');
		try {
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
				return { ...row, reason: `commit: ${plainCommitError(committed.error ?? 'commit failed')}` };
			}
		} else if (step.kind === 'pack') {
			const release = await readReleaseTarget(abs);
			if (!release || release.target.directory !== initial.target.directory || release.target.manifest !== initial.target.manifest) throw new Error('Release target changed. Open a new plan.');
			prepared = await prepareRelease(abs, release.target, step.name, step.version, command);
			row = { ...row, artifact: prepared.artifact };
			emit(index, step.kind, 'done', prepared.artifact);
			continue;
		} else if (step.kind === 'push') {
			if (prepared) { assertReleaseTree(abs, prepared.head); await assertReleaseArchive(prepared.artifact); }
			const git = readGit(abs);
			if (git.branch !== step.branch || git.origin?.replaceAll('\\', '/') !== step.origin.replaceAll('\\', '/')) throw new Error('Push target changed. Refresh and open a new Publish plan.');
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
			if (!prepared) throw new Error('No verified archive. Open a new Publish plan.');
			assertReleaseTree(abs, prepared.head); await assertReleaseArchive(prepared.artifact);
			const args = ['publish', prepared.artifact.archive, '--access', 'public', '--ignore-scripts', '--workspaces=false'];
			if (opts.otp) args.push('--otp', opts.otp);
			const run = opts.run ?? defaultPublishRunner;
			const result = await Promise.resolve(run(initial.target.directory, args));
			if (!result.ok) {
				emit(index, step.kind, 'fail');
				const stderr = result.stderr.trim();
				const stdout = result.stdout.trim();
				return {
					...row,
					stdout: stdout || undefined,
					stderr: stderr || undefined,
					reason: plainPublishError([stderr, stdout].filter(Boolean).join('\n') || 'npm publish failed'),
				};
			}
			emit(index, step.kind, 'done');
			let warning: string | undefined;
			const pkg = await readPkg(path.join(initial.target.directory, 'package.json'));
			if (!('error' in pkg)) {
				try { for (const hook of ['publish', 'postpublish']) if (pkg.scripts?.[hook]) await runReleaseCommand(command, initial.target.directory, ['run', hook, '--if-present', '--ignore-scripts']); }
				catch (err) { warning = `Published successfully; follow-up hook failed: ${plainPublishError((err as Error).message)}`; }
			}
			return {
				...row,
				stdout: result.stdout.trim() || undefined,
				stderr: result.stderr.trim() || undefined,
				reason: `published ${step.name}@${step.version}`,
				warning,
			};
		}
		emit(index, step.kind, 'done');
		} catch (err) {
			emit(index, step.kind, 'fail');
			return { ...row, reason: `${step.kind}: ${plainPublishError(err instanceof Error ? err.message : String(err))}` };
		}
	}
	return { ...row, reason: 'no publish step' };
}
