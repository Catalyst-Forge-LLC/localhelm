import { compareSemver } from './semver.js';
import type { NpmCell } from './types.js';

const TTL_MS = 5 * 60_000;
const DEFAULT_CONCURRENCY = 8;

type CacheEntry = { cell: NpmCell; at: number };

const cache = new Map<string, CacheEntry>();

function encodeName(name: string): string {
	return name.startsWith('@') ? name.replace('/', '%2f') : name;
}

/** Run `fn` over items with a fixed worker pool. Order of results matches `items`. */
export async function mapPool<T, R>(
	items: readonly T[],
	concurrency: number,
	fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
	const results = new Array<R>(items.length);
	if (!items.length) return results;
	let next = 0;
	const workers = Math.min(Math.max(1, concurrency), items.length);
	await Promise.all(
		Array.from({ length: workers }, async () => {
			while (next < items.length) {
				const index = next++;
				results[index] = await fn(items[index] as T, index);
			}
		}),
	);
	return results;
}

export async function npmLatest(name: string): Promise<NpmCell> {
	const hit = cache.get(name);
	if (hit && Date.now() - hit.at < TTL_MS) return hit.cell;
	const url = `https://registry.npmjs.org/${encodeName(name)}/latest`;
	try {
		const res = await fetch(url, {
			headers: { accept: 'application/json' },
			signal: AbortSignal.timeout(15_000),
		});
		if (res.status === 404) {
			const cell: NpmCell = { name, status: 'none' };
			cache.set(name, { cell, at: Date.now() });
			return cell;
		}
		if (!res.ok) {
			const cell: NpmCell = { name, status: 'error', error: `npm HTTP ${res.status} for ${name}` };
			cache.set(name, { cell, at: Date.now() });
			return cell;
		}
		const body: unknown = await res.json();
		const version =
			body && typeof body === 'object' && 'version' in body && typeof body.version === 'string'
				? body.version
				: undefined;
		if (!version) {
			const cell: NpmCell = { name, status: 'error', error: `npm latest missing version for ${name}` };
			cache.set(name, { cell, at: Date.now() });
			return cell;
		}
		const cell: NpmCell = { name, latest: version, status: 'ok' };
		cache.set(name, { cell, at: Date.now() });
		return cell;
	} catch (err) {
		const cell: NpmCell = {
			name,
			status: 'error',
			error: err instanceof Error ? err.message : String(err),
		};
		cache.set(name, { cell, at: Date.now() });
		return cell;
	}
}

export async function npmLatestMany(
	names: Iterable<string>,
	concurrency = DEFAULT_CONCURRENCY,
): Promise<Map<string, NpmCell>> {
	const list = [...new Set([...names].map((name) => name.trim()).filter(Boolean))];
	const cells = await mapPool(list, concurrency, (name) => npmLatest(name));
	return new Map(list.map((name, i) => [name, cells[i] as NpmCell]));
}

export type WaitForNpmVersionOpts = {
	timeoutMs?: number;
	intervalMs?: number;
	now?: () => number;
	sleep?: (ms: number) => Promise<void>;
	probe?: (name: string, version: string) => Promise<NpmCell>;
};

/** Poll until this exact version is on the registry. `/latest` can lag a just-published tarball. */
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

export async function npmHasVersion(name: string, version: string): Promise<NpmCell> {
	const url = `https://registry.npmjs.org/${encodeName(name)}/${encodeURIComponent(version)}`;
	try {
		const res = await fetch(url, {
			headers: { accept: 'application/json' },
			signal: AbortSignal.timeout(15_000),
		});
		if (res.status === 404) return { name, status: 'none' };
		if (!res.ok) return { name, status: 'error', error: `npm HTTP ${res.status} for ${name}@${version}` };
		const body: unknown = await res.json();
		const found =
			body && typeof body === 'object' && 'version' in body && typeof body.version === 'string'
				? body.version
				: undefined;
		if (!found) return { name, status: 'error', error: `npm missing version for ${name}@${version}` };
		return { name, latest: found, status: 'ok' };
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

/** `/latest` can lag a just-published version. If local is already on the registry, treat it as latest. */
export function withPublishedLocal(latest: NpmCell, localVersion: string, localIsOnNpm: boolean): NpmCell {
	if (!localIsOnNpm || latest.status !== 'ok' || !latest.latest) return latest;
	const cmp = compareSemver(localVersion, latest.latest);
	if (cmp === null || cmp <= 0) return latest;
	return { ...latest, latest: localVersion };
}

export async function liftLatestIfVersionExists(name: string, localVersion: string, latest: NpmCell): Promise<NpmCell> {
	if (latest.status !== 'ok' || !latest.latest) return latest;
	const cmp = compareSemver(localVersion, latest.latest);
	if (cmp === null || cmp <= 0) return latest;
	const has = await npmHasVersion(name, localVersion);
	return withPublishedLocal(latest, localVersion, has.status === 'ok');
}
