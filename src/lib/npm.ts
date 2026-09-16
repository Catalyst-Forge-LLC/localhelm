import { spawn, spawnSync } from 'node:child_process';
import { compareSemver } from './semver.js';
import type { NpmCell } from './types.js';

const TTL_MS = 5 * 60_000;
const ERROR_TTL_MS = 30_000;
const DEFAULT_CONCURRENCY = 8;
const SEARCH_LIMIT = '250';
const VIEW_TIMEOUT_MS = 20_000;
const SEARCH_TIMEOUT_MS = 45_000;

type CacheEntry = { cell: NpmCell; at: number };

const cache = new Map<string, CacheEntry>();
const inflight = new Map<string, Promise<NpmCell>>();

export type NpmCliResult = { status: number; stdout: string; stderr: string };
export type NpmCliRun = (args: readonly string[], timeoutMs: number) => Promise<NpmCliResult>;

export type NpmLookupOpts = {
	/** `npm whoami` user. Only used when `ownerSearch` is on (there is no `npm view --owner`). */
	owner?: string | null;
	/** Block on `npm search maintainer:<owner>`. Off by default — search can take ~45s and still miss names. */
	ownerSearch?: boolean;
	/** Pass `--prefer-online` (Refresh / fetch remotes). Default uses the local npm cache. */
	preferOnline?: boolean;
	run?: NpmCliRun;
};

/** Run `fn` over items with a fixed worker pool. Order of results matches `items`. */
export async function mapPool<T, R>(
	items: readonly T[],
	concurrency: number,
	fn: (item: T, index: number) => Promise<R>,
	onProgress?: (done: number, total: number) => void,
): Promise<R[]> {
	const results = new Array<R>(items.length);
	if (!items.length) return results;
	let next = 0;
	const workers = Math.min(Math.max(1, concurrency), items.length);
	let finished = 0;
	await Promise.all(
		Array.from({ length: workers }, async () => {
			while (next < items.length) {
				const index = next++;
				results[index] = await fn(items[index] as T, index);
				finished += 1;
				onProgress?.(finished, items.length);
			}
		}),
	);
	return results;
}

function npmBin(): string {
	return process.platform === 'win32' ? 'npm.cmd' : 'npm';
}

export function parseNpmWhoami(stdout: string): string | null {
	const user = stdout
		.trim()
		.split(/\r?\n/)
		.map((line) => line.trim())
		.find((line) => line.length > 0 && !line.startsWith('npm '));
	return user || null;
}

export function npmWhoami(): string | null {
	const win = process.platform === 'win32';
	const result = spawnSync(npmBin(), ['whoami'], {
		encoding: 'utf8',
		windowsHide: true,
		shell: win,
		timeout: 15_000,
	});
	if (result.error || result.status !== 0) return null;
	return parseNpmWhoami(result.stdout ?? '');
}

export function runNpmCli(args: readonly string[], timeoutMs: number): Promise<NpmCliResult> {
	return new Promise((resolve) => {
		const win = process.platform === 'win32';
		const child = spawn(npmBin(), [...args], { windowsHide: true, shell: win });
		const out: Buffer[] = [];
		const err: Buffer[] = [];
		const finish = (result: NpmCliResult): void => {
			clearTimeout(timer);
			resolve(result);
		};
		const timer = setTimeout(() => {
			child.kill();
			finish({ status: 1, stdout: '', stderr: `npm timed out after ${Math.round(timeoutMs / 1000)}s` });
		}, timeoutMs);
		child.stdout?.on('data', (chunk: Buffer) => {
			out.push(chunk);
		});
		child.stderr?.on('data', (chunk: Buffer) => {
			err.push(chunk);
		});
		child.on('error', (error) => {
			finish({ status: 1, stdout: '', stderr: error.message });
		});
		child.on('close', (code) => {
			finish({
				status: code ?? 1,
				stdout: Buffer.concat(out).toString('utf8'),
				stderr: Buffer.concat(err).toString('utf8'),
			});
		});
	});
}

function runner(opts?: NpmLookupOpts): NpmCliRun {
	return opts?.run ?? runNpmCli;
}

export function parseMaintainerSearchJson(stdout: string): { name: string; version: string }[] {
	const trimmed = stdout.trim();
	if (!trimmed) return [];
	let body: unknown;
	try {
		body = JSON.parse(trimmed);
	} catch {
		return [];
	}
	const rows = Array.isArray(body)
		? body
		: body && typeof body === 'object' && 'objects' in body && Array.isArray(body.objects)
			? body.objects
			: [];
	const hits: { name: string; version: string }[] = [];
	for (const row of rows) {
		if (!row || typeof row !== 'object') continue;
		const rec = row as Record<string, unknown>;
		const pkg =
			rec.package && typeof rec.package === 'object' ? (rec.package as Record<string, unknown>) : rec;
		const name = typeof pkg.name === 'string' ? pkg.name : undefined;
		const version = typeof pkg.version === 'string' ? pkg.version : undefined;
		if (name && version) hits.push({ name, version });
	}
	return hits;
}

export function parseNpmViewVersion(stdout: string): string | undefined {
	const trimmed = stdout.trim();
	if (!trimmed) return undefined;
	try {
		const body: unknown = JSON.parse(trimmed);
		if (typeof body === 'string' && body) return body;
		if (body && typeof body === 'object' && 'version' in body && typeof body.version === 'string') {
			return body.version;
		}
	} catch {
		if (/^\d+\.\d+/.test(trimmed)) return trimmed;
	}
	return undefined;
}

export function npmCliNotFound(stderr: string, status: number): boolean {
	if (status === 0) return false;
	return /\bE404\b|\b404\b|no such package|not found/i.test(stderr);
}

function cliMessage(stderr: string, fallback: string): string {
	const line = stderr
		.split(/\r?\n/)
		.map((part) => part.trim())
		.reverse()
		.find((part) => part.length > 0 && !part.startsWith('npm notice'));
	return line || fallback;
}

function cacheTtl(cell: NpmCell): number {
	return cell.status === 'error' ? ERROR_TTL_MS : TTL_MS;
}

function cached(name: string): NpmCell | undefined {
	const hit = cache.get(name);
	if (!hit) return undefined;
	if (Date.now() - hit.at >= cacheTtl(hit.cell)) {
		cache.delete(name);
		return undefined;
	}
	return hit.cell;
}

function remember(name: string, cell: NpmCell): NpmCell {
	cache.set(name, { cell, at: Date.now() });
	return cell;
}

function cellFromView(name: string, result: NpmCliResult): NpmCell {
	if (result.status === 0) {
		const version = parseNpmViewVersion(result.stdout);
		if (version) return { name, latest: version, status: 'ok' };
		return { name, status: 'error', error: `npm view missing version for ${name}` };
	}
	if (npmCliNotFound(result.stderr, result.status)) return { name, status: 'none' };
	return { name, status: 'error', error: cliMessage(result.stderr, `npm view failed for ${name}`) };
}

function viewArgs(name: string, preferOnline: boolean): string[] {
	const args = ['view', name, 'version', '--json'];
	if (preferOnline) args.push('--prefer-online');
	return args;
}

async function viewLatest(name: string, run: NpmCliRun, preferOnline = false): Promise<NpmCell> {
	const hit = cached(name);
	if (hit) return hit;
	const pending = inflight.get(name);
	if (pending) return pending;
	const work = (async (): Promise<NpmCell> => {
		try {
			const result = await run(viewArgs(name, preferOnline), VIEW_TIMEOUT_MS);
			return remember(name, cellFromView(name, result));
		} catch (err) {
			return remember(name, {
				name,
				status: 'error',
				error: err instanceof Error ? err.message : String(err),
			});
		} finally {
			inflight.delete(name);
		}
	})();
	inflight.set(name, work);
	return work;
}

async function seedMaintainerLatest(owner: string, run: NpmCliRun): Promise<void> {
	const user = owner.trim();
	if (!/^[a-z0-9._-]+$/i.test(user)) return;
	try {
		const result = await run(
			['search', `maintainer:${user}`, '--json', '--searchlimit', SEARCH_LIMIT, '--prefer-online', '--no-description'],
			SEARCH_TIMEOUT_MS,
		);
		if (result.status !== 0) return;
		for (const hit of parseMaintainerSearchJson(result.stdout)) {
			if (cached(hit.name)) continue;
			remember(hit.name, { name: hit.name, latest: hit.version, status: 'ok' });
		}
	} catch {
		// Leftover `npm view` fills the enrolled names.
	}
}

export async function npmLatest(name: string, opts?: NpmLookupOpts): Promise<NpmCell> {
	return viewLatest(name, runner(opts), Boolean(opts?.preferOnline));
}

export async function npmLatestMany(
	names: Iterable<string>,
	concurrency = DEFAULT_CONCURRENCY,
	onProgress?: (done: number, total: number) => void,
	opts?: NpmLookupOpts,
): Promise<Map<string, NpmCell>> {
	const list = [...new Set([...names].map((name) => name.trim()).filter(Boolean))];
	const run = runner(opts);
	const preferOnline = Boolean(opts?.preferOnline);
	const owner = opts?.ownerSearch ? opts.owner?.trim() : undefined;
	if (owner && list.length) await seedMaintainerLatest(owner, run);
	const cells = await mapPool(
		list,
		concurrency,
		(name) => viewLatest(name, run, preferOnline),
		onProgress,
	);
	return new Map(list.map((name, i) => [name, cells[i] ?? { name, status: 'error', error: `npm view failed for ${name}` }]));
}

export type WaitForNpmVersionOpts = {
	timeoutMs?: number;
	intervalMs?: number;
	now?: () => number;
	sleep?: (ms: number) => Promise<void>;
	probe?: (name: string, version: string) => Promise<NpmCell>;
};

/** Poll until this exact version is on the registry. `npm view` latest can lag a just-published tarball. */
export async function waitForNpmVersion(
	name: string,
	version: string,
	opts: WaitForNpmVersionOpts = {},
): Promise<NpmCell> {
	const timeoutMs = opts.timeoutMs ?? 90_000;
	const intervalMs = opts.intervalMs ?? 2_000;
	const now = opts.now ?? Date.now;
	const sleep = opts.sleep ?? ((ms: number) => new Promise((resolve) => setTimeout(resolve, ms)));
	const probe = opts.probe ?? npmHasVersion;
	const deadline = now() + timeoutMs;
	let last = await probe(name, version);
	while (last.status !== 'ok' && now() < deadline) {
		await sleep(Math.min(intervalMs, Math.max(0, deadline - now())));
		last = await probe(name, version);
	}
	if (last.status === 'ok') return last;
	if (last.status === 'none') {
		return { name, status: 'none', error: `${name}@${version} is not on npm yet` };
	}
	return last;
}

export async function npmHasVersion(name: string, version: string, opts?: NpmLookupOpts): Promise<NpmCell> {
	try {
		const args = ['view', `${name}@${version}`, 'version', '--json'];
		if (opts?.preferOnline) args.push('--prefer-online');
		const result = await runner(opts)(args, VIEW_TIMEOUT_MS);
		return cellFromView(name, result);
	} catch (err) {
		return {
			name,
			status: 'error',
			error: err instanceof Error ? err.message : String(err),
		};
	}
}

export function clearNpmCache(): void {
	cache.clear();
}

/** Latest from search/view can lag a just-published version. If local is already on the registry, treat it as latest. */
export function withPublishedLocal(latest: NpmCell, localVersion: string, localIsOnNpm: boolean): NpmCell {
	if (!localIsOnNpm || latest.status !== 'ok' || !latest.latest) return latest;
	const cmp = compareSemver(localVersion, latest.latest);
	if (cmp === null || cmp <= 0) return latest;
	return { ...latest, latest: localVersion };
}

export async function liftLatestIfVersionExists(
	name: string,
	localVersion: string,
	latest: NpmCell,
	opts?: NpmLookupOpts,
): Promise<NpmCell> {
	if (latest.status !== 'ok' || !latest.latest) return latest;
	const cmp = compareSemver(localVersion, latest.latest);
	if (cmp === null || cmp <= 0) return latest;
	const has = await npmHasVersion(name, localVersion, opts);
	return withPublishedLocal(latest, localVersion, has.status === 'ok');
}
