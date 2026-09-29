import { spawnSync } from 'node:child_process';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { commitPaths, helmRetargetMessage, helmUpdateMessage } from './commit.js';
import { fleetDeps } from './deps.js';
import type { LoadedManifest } from './manifest.js';
import { npmHasVersion, npmLatest } from './npm.js';
import { lockResolves, resolveLockRoot, retargetSpecifier } from './pinwrite.js';
import { pathExists, rootPkgPath, sitePkgPath } from './pkg.js';
import { caretRange, parseTriple, rangeCovers } from './semver.js';
import { fleetStatus } from './status.js';
import type { PinEdge } from './types.js';

export type CascadeRow = {
	fromId: string;
	fromFile: 'root' | 'site';
	file: string;
	lockRoot: string;
	projectAbs: string;
	name: string;
	fromSpec: string;
	toSpec: string | null;
	action: 'retarget' | 'refresh' | 'skip';
	reason?: string;
	writes?: boolean;
	committed?: boolean;
	/** pnpm update rewrote package.json as well as the lockfile. */
	pkgChanged?: boolean;
};

export type CascadePlan = {
	publisherId: string;
	npm: string;
	to: string;
	localUnpublished?: string;
	note: string;
	commit: boolean;
	cycles: string[][];
	rows: CascadeRow[];
};

export type CascadeApplyResult = CascadePlan & { writes: boolean };

function pkgFileFor(projectAbs: string, fromFile: 'root' | 'site'): string {
	return fromFile === 'site' ? sitePkgPath(projectAbs) : rootPkgPath(projectAbs);
}

function skipLink(kind: PinEdge['kind']): string | undefined {
	if (kind === 'link' || kind === 'file') {
		return `local ${kind}: — not switching to registry (confirm that separately)`;
	}
	if (kind === 'workspace' || kind === 'git') return `${kind} pin — not a registry range`;
	return undefined;
}

async function resolveTarget(
	npmName: string,
	requested: string | undefined,
	confirmTo?: (name: string, version: string) => Promise<boolean>,
): Promise<{ to: string } | { error: string }> {
	if (requested) {
		const version = requested.replace(/^v/i, '');
		if (!parseTriple(version)) return { error: `not a semver x.y.z: ${requested}` };
		if (confirmTo) {
			return (await confirmTo(npmName, version))
				? { to: version }
				: { error: `${npmName}@${version} is not on npm` };
		}
		const cell = await npmHasVersion(npmName, version);
		if (cell.status === 'ok' && cell.latest) return { to: cell.latest };
		if (cell.status === 'none') return { error: `${npmName}@${requested} is not on npm` };
		return { error: cell.error ?? `could not confirm ${npmName}@${requested}` };
	}
	const latest = await npmLatest(npmName);
	if (latest.status === 'ok' && latest.latest) return { to: latest.latest };
	if (latest.status === 'none') return { error: `${npmName} is not on npm` };
	return { error: latest.error ?? `could not read npm latest for ${npmName}` };
}

function runPnpm(cwd: string, args: string[]): { ok: boolean; stdout: string; stderr: string } {
	const result = spawnSync(process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm', args, {
		cwd,
		encoding: 'utf8',
		windowsHide: true,
		shell: process.platform === 'win32',
		timeout: 120_000,
	});
	const stdout = result.stdout ?? '';
	const stderr = result.stderr ?? '';
	if (result.error) return { ok: false, stdout, stderr: result.error.message };
	if (result.status !== 0) {
		return { ok: false, stdout, stderr: stderr.trim() || `pnpm ${args.join(' ')} exited ${result.status}` };
	}
	return { ok: true, stdout, stderr };
}

export async function planCascade(
	loaded: LoadedManifest,
	publisherId: string,
	opts: {
		to?: string;
		commit?: boolean;
		/** Also refresh lockfiles whose range already allows `to`. */
		refresh?: boolean;
		confirmTo?: (name: string, version: string) => Promise<boolean>;
	} = {},
): Promise<CascadePlan> {
	const inventory = await fleetStatus(loaded);
	const publisher = inventory.projects.find((row) => row.id === publisherId);
	if (!publisher) {
		throw new Error(`not enrolled: ${publisherId}`);
	}
	const npmName = publisher.npm.name;
	if (!npmName) throw new Error(`${publisherId} has no npm package name`);

	const target = await resolveTarget(npmName, opts.to, opts.confirmTo);
	if ('error' in target) throw new Error(target.error);

	const toSpec = caretRange(target.to);
	const deps = fleetDeps(inventory, publisherId);
	const dependents = deps.publishers[0]?.dependents ?? [];
	const byId = new Map(inventory.projects.map((row) => [row.id, row]));
	const rows: CascadeRow[] = [];

	for (const pin of dependents) {
		const consumer = byId.get(pin.fromId);
		const projectAbs = consumer?.absPath ?? '';
		const file = consumer ? pkgFileFor(projectAbs, pin.fromFile) : '';
		const lockRoot = consumer ? await resolveLockRoot(projectAbs, pin.fromFile) : '';
		const base = {
			fromId: pin.fromId,
			fromFile: pin.fromFile,
			file,
			lockRoot,
			projectAbs,
			name: pin.name,
			fromSpec: pin.spec,
			toSpec,
		};

		if (!consumer) {
			rows.push({ ...base, action: 'skip', reason: 'consumer missing from inventory' });
			continue;
		}
		if (consumer.missing) {
			rows.push({ ...base, action: 'skip', reason: 'folder missing' });
			continue;
		}
		if (!(await pathExists(file))) {
			rows.push({ ...base, action: 'skip', reason: `no ${pin.fromFile} package.json` });
			continue;
		}
		const linkReason = skipLink(pin.kind);
		if (linkReason) {
			rows.push({ ...base, toSpec: null, action: 'skip', reason: linkReason });
			continue;
		}
		if (consumer.git.busy) {
			rows.push({ ...base, action: 'skip', reason: `mid-${consumer.git.busy}` });
			continue;
		}
		if (consumer.git.dirty) {
			rows.push({ ...base, action: 'skip', reason: 'dirty' });
			continue;
		}
		if (rangeCovers(pin.spec, target.to)) {
			if (opts.refresh) {
				rows.push({ ...base, action: 'refresh', reason: `refresh lockfile to ${target.to}` });
			} else {
				rows.push({ ...base, action: 'skip', reason: `already covers ${target.to}` });
			}
			continue;
		}
		rows.push({ ...base, action: 'retarget' });
	}

	const plan: CascadePlan = {
		publisherId,
		npm: npmName,
		to: target.to,
		note: `This retargets dependents' pins on ${npmName}@${target.to} only. It does not publish those dependents or cascade the next wave.`,
		commit: opts.commit !== false,
		cycles: deps.cycles,
		rows,
	};
	if (publisher.unpublishedAhead && publisher.localVersion && publisher.localVersion !== target.to) {
		plan.localUnpublished = publisher.localVersion;
	}
	return plan;
}

/** Files a finished cascade row should commit. Refresh includes package.json only when pnpm rewrote it. */
export function cascadeCommitFiles(input: {
	action: 'retarget' | 'refresh';
	pkgFile: string;
	lockFile: string | null;
	pkgChanged: boolean;
}): string[] {
	const files: string[] = [];
	if (input.action === 'retarget' || input.pkgChanged) files.push(input.pkgFile);
	if (input.lockFile) files.push(input.lockFile);
	return files;
}

export type CascadeProjectProgress = {
	index: number;
	total: number;
	id: string;
	status: 'start' | 'done';
};

export async function applyCascade(
	plan: CascadePlan,
	opts: { onProject?: (event: CascadeProjectProgress) => void } = {},
): Promise<CascadeApplyResult> {
	const writable = plan.rows.filter((row) => row.action === 'retarget' || row.action === 'refresh');
	if (writable.length === 0) return { ...plan, writes: false };

	const ids = [...new Set(writable.map((row) => row.fromId))];
	for (let i = 0; i < ids.length; i++) {
		const id = ids[i] ?? '';
		opts.onProject?.({ index: i + 1, total: ids.length, id, status: 'start' });
		await applyCascadeRows(
			plan,
			writable.filter((row) => row.fromId === id),
		);
		opts.onProject?.({ index: i + 1, total: ids.length, id, status: 'done' });
	}

	return { ...plan, writes: writable.some((row) => row.writes) };
}

async function applyCascadeRows(plan: CascadePlan, writable: CascadeRow[]): Promise<void> {
	if (writable.length === 0) return;

	const byFile = new Map<string, CascadeRow[]>();
	for (const row of writable) {
		if (row.action !== 'retarget') continue;
		const list = byFile.get(row.file) ?? [];
		list.push(row);
		byFile.set(row.file, list);
	}

	for (const [file, group] of byFile) {
		let raw = await readFile(file, 'utf8');
		for (const row of group) {
			if (!row.toSpec) continue;
			raw = retargetSpecifier(raw, row.name, row.toSpec);
		}
		await writeFile(file, raw, 'utf8');
		for (const row of group) row.writes = true;
	}

	const lockRoots = new Map<string, CascadeRow[]>();
	for (const row of writable) {
		const list = lockRoots.get(row.lockRoot) ?? [];
		list.push(row);
		lockRoots.set(row.lockRoot, list);
	}

	for (const [lockRoot, group] of lockRoots) {
		const lockFile = path.join(lockRoot, 'pnpm-lock.yaml');
		if (!(await pathExists(lockFile))) {
			for (const row of group) {
				row.reason = row.reason ? `${row.reason}; no lockfile` : 'no lockfile';
			}
			continue;
		}
		const retargets = group.filter((row) => row.action === 'retarget');
		const refreshes = group.filter((row) => row.action === 'refresh');
		if (retargets.length) {
			const installed = runPnpm(lockRoot, ['install', '--lockfile-only']);
			if (!installed.ok) {
				for (const row of retargets) row.reason = `lockfile: ${installed.stderr}`;
			} else {
				const lockText = await readFile(lockFile, 'utf8');
				for (const row of retargets) {
					if (!lockResolves(lockText, row.name, plan.to)) {
						row.reason = `lockfile did not resolve ${row.name}@${plan.to}`;
					}
				}
			}
		}
		if (refreshes.length) {
			const pkgBefore = new Map<string, string>();
			for (const row of refreshes) {
				if (!pkgBefore.has(row.file)) pkgBefore.set(row.file, await readFile(row.file, 'utf8'));
			}
			const before = await readFile(lockFile, 'utf8');
			const names = [...new Set(refreshes.map((row) => row.name))];
			const updated = runPnpm(lockRoot, ['update', ...names, '--lockfile-only']);
			if (!updated.ok) {
				for (const row of refreshes) row.reason = `lockfile: ${updated.stderr}`;
				continue;
			}
			const after = await readFile(lockFile, 'utf8');
			for (const row of refreshes) {
				const pkgChanged = (await readFile(row.file, 'utf8')) !== pkgBefore.get(row.file);
				const lockChanged = after !== before;
				if (!lockResolves(after, row.name, plan.to)) {
					row.writes = pkgChanged;
					row.reason = `lockfile did not resolve ${row.name}@${plan.to}`;
				} else if (!pkgChanged && !lockChanged) {
					row.writes = false;
					row.reason = `already resolves ${plan.to}`;
				} else {
					row.writes = true;
					row.reason = pkgChanged ? `updated ${row.name} to ${plan.to}` : `updated lockfile to ${plan.to}`;
				}
				if (pkgChanged) row.pkgChanged = true;
			}
		}
	}

	if (plan.commit) {
		const byRepo = new Map<string, { files: Set<string>; rows: CascadeRow[] }>();
		for (const row of writable) {
			if (!row.writes) continue;
			const entry = byRepo.get(row.projectAbs) ?? { files: new Set<string>(), rows: [] };
			const lockFile = path.join(row.lockRoot, 'pnpm-lock.yaml');
			const hasLock = await pathExists(lockFile);
			for (const file of cascadeCommitFiles({
				action: row.action === 'refresh' ? 'refresh' : 'retarget',
				pkgFile: row.file,
				lockFile: hasLock ? lockFile : null,
				pkgChanged: row.pkgChanged === true,
			})) {
				entry.files.add(file);
			}
			entry.rows.push(row);
			byRepo.set(row.projectAbs, entry);
		}
		for (const [repo, entry] of byRepo) {
			const message = entry.rows.every((row) => row.action === 'refresh')
				? helmUpdateMessage(plan.npm, plan.to)
				: helmRetargetMessage(plan.npm, plan.to);
			const result = commitPaths(repo, [...entry.files], message);
			for (const row of entry.rows) {
				if (result.ok) row.committed = true;
				else row.reason = row.reason ? `${row.reason}; commit: ${result.error}` : `commit: ${result.error}`;
			}
		}
	}
}
