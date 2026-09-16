import { spawn, spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import path from 'node:path';
import { compareSemver } from './semver.js';
import type { NpmCell } from './types.js';

const TTL_MS = 5 * 60_000;
const ERROR_TTL_MS = 10_000;
const DEFAULT_CONCURRENCY = 8;
const SEARCH_LIMIT = '250';
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
	/** Refresh / fetch remotes: skip the in-process cache (caller already clears) and retry 429. */
	preferOnline?: boolean;
	run?: NpmCliRun;
	fetch?: typeof fetch;
	/** Explicit registry token. `null` = anonymous. Omit to read `~/.npmrc`. */
	token?: string | null;
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
	const lines = stdout
		.split(/\r?\n/)
		.map((line) => line.trim())
		.filter((line) => line.length > 0 && !/^npm (warn|notice|error)\b/i.test(line));
	for (const candidate of [...lines].reverse()) {
		try {
			const body: unknown = JSON.parse(candidate);
			if (typeof body === 'string' && body) return body;
			if (body && typeof body === 'object' && 'version' in body && typeof body.version === 'string') {
				return body.version;
			}
		} catch {
			if (/^\d+\.\d+/.test(candidate)) return candidate;
		}
	}
	return undefined;
}

export function parseNpmrcAuthToken(text: string): string | null {
	for (const raw of text.split(/\r?\n/)) {
		const line = raw.trim();
		if (!line || line.startsWith('#')) continue;
		const match = /^\/\/registry\.npmjs\.org\/:_authToken\s*=\s*(.+)$/.exec(line);
		if (!match?.[1]) continue;
		let value = match[1].trim().replace(/^["']|["']$/g, '');
		const env = /^\$\{([A-Za-z_][A-Za-z0-9_]*)\}$/.exec(value);
		if (env?.[1]) return process.env[env[1]] || null;
		return value || null;
	}
	return null;
}

let tokenMemo: { at: number; token: string | null } | null = null;

export function npmRegistryToken(): string | null {
	if (tokenMemo && Date.now() - tokenMemo.at < TTL_MS) return tokenMemo.token;
	const files = [path.join(homedir(), '.npmrc')];
	let token: string | null = null;
	for (const file of files) {
		if (!existsSync(file)) continue;
		token = parseNpmrcAuthToken(readFileSync(file, 'utf8'));
		if (token) break;
	}
	token = token ?? process.env.NPM_TOKEN ?? null;
	tokenMemo = { at: Date.now(), token };
	return token;
}

function encodeName(name: string): string {
	return name.replaceAll('/', '%2f');
}

function resolveToken(opts?: NpmLookupOpts): string | null {
	if (opts && 'token' in opts) return opts.token ?? null;
	return npmRegistryToken();
}

function registryHeaders(token: string | null): Record<string, string> {
	const headers: Record<string, string> = { accept: 'application/json' };
	if (token) headers.authorization = `Bearer ${token}`;
	return headers;
}

function versionFromPackument(body: unknown): string | undefined {
	if (!body || typeof body !== 'object') return undefined;
	const version = 'version' in body && typeof body.version === 'string' ? body.version : undefined;
	return version || undefined;
}

async function registryGet(
	url: string,
	opts: NpmLookupOpts | undefined,
	retry429: boolean,
): Promise<{ status: number; body: unknown; error?: string }> {
	const doFetch = opts?.fetch ?? fetch;
	try {
		const res = await doFetch(url, {
			headers: registryHeaders(resolveToken(opts)),
			signal: AbortSignal.timeout(15_000),
		});
		if (res.status === 429 && retry429) {
			await new Promise((resolve) => setTimeout(resolve, 400));
			return registryGet(url, opts, false);
		}
		if (res.status === 404) return { status: 404, body: null };
		if (!res.ok) return { status: res.status, body: null, error: `npm HTTP ${res.status}` };
		return { status: res.status, body: await res.json() };
	} catch (err) {
		return { status: 0, body: null, error: err instanceof Error ? err.message : String(err) };
	}
}

function cellFromRegistry(name: string, got: { status: number; body: unknown; error?: string }): NpmCell {
	if (got.status === 404) return { name, status: 'none' };
	if (got.error || got.status === 0) {
		return { name, status: 'error', error: got.error ?? `npm lookup failed for ${name}` };
	}
	const version = versionFromPackument(got.body);
	if (!version) return { name, status: 'error', error: `npm latest missing version for ${name}` };
	return { name, latest: version, status: 'ok' };
}

async function registryLatest(name: string, opts?: NpmLookupOpts): Promise<NpmCell> {
	const url = `https://registry.npmjs.org/${encodeName(name)}/latest`;
	return cellFromRegistry(name, await registryGet(url, opts, true));
}

export function npmCliNotFound(stderr: string, status: number): boolean {
	if (status === 0) return false;
	return /\bE404\b|\b404\b|no such package|not found/i.test(stderr);
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

async function lookupLatest(name: string, opts?: NpmLookupOpts): Promise<NpmCell> {
	const hit = cached(name);
	if (hit) return hit;
	const pending = inflight.get(name);
	if (pending) return pending;
	const work = (async (): Promise<NpmCell> => {
		try {
			return remember(name, await registryLatest(name, opts));
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
	return lookupLatest(name, opts);
}

export async function npmLatestMany(
	names: Iterable<string>,
	concurrency = DEFAULT_CONCURRENCY,
	onProgress?: (done: number, total: number) => void,
	opts?: NpmLookupOpts,
): Promise<Map<string, NpmCell>> {
	const list = [...new Set([...names].map((name) => name.trim()).filter(Boolean))];
	const owner = opts?.ownerSearch ? opts.owner?.trim() : undefined;
	if (owner && list.length) await seedMaintainerLatest(owner, runner(opts));
	const cells = await mapPool(list, concurrency, (name) => lookupLatest(name, opts), onProgress);
	return new Map(list.map((name, i) => [name, cells[i] ?? { name, status: 'error', error: `npm lookup failed for ${name}` }]));
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
	const url = `https://registry.npmjs.org/${encodeName(name)}/${encodeURIComponent(version)}`;
	return cellFromRegistry(name, await registryGet(url, opts, true));
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
