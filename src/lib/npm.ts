import { compareSemver } from './semver.js';
import type { NpmCell } from './types.js';

const cache = new Map<string, NpmCell>();

function encodeName(name: string): string {
	return name.startsWith('@') ? name.replace('/', '%2f') : name;
}

export async function npmLatest(name: string): Promise<NpmCell> {
	const hit = cache.get(name);
	if (hit) return hit;
	const url = `https://registry.npmjs.org/${encodeName(name)}/latest`;
	try {
		const res = await fetch(url, {
			headers: { accept: 'application/json' },
			signal: AbortSignal.timeout(15_000),
		});
		if (res.status === 404) {
			const cell: NpmCell = { name, status: 'none' };
			cache.set(name, cell);
			return cell;
		}
		if (!res.ok) {
			const cell: NpmCell = { name, status: 'error', error: `npm HTTP ${res.status} for ${name}` };
			cache.set(name, cell);
			return cell;
		}
		const body: unknown = await res.json();
		const version =
			body && typeof body === 'object' && 'version' in body && typeof body.version === 'string'
				? body.version
				: undefined;
		if (!version) {
			const cell: NpmCell = { name, status: 'error', error: `npm latest missing version for ${name}` };
			cache.set(name, cell);
			return cell;
		}
		const cell: NpmCell = { name, latest: version, status: 'ok' };
		cache.set(name, cell);
		return cell;
	} catch (err) {
		const cell: NpmCell = {
			name,
			status: 'error',
			error: err instanceof Error ? err.message : String(err),
		};
		cache.set(name, cell);
		return cell;
	}
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
		return { name, status: 'error', error: err instanceof Error ? err.message : String(err) };
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
