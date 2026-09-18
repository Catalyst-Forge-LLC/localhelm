import { json } from '@sveltejs/kit';
import {
	acquireJobLock,
	assertDemoAllowsRepoWrite,
	findManifest,
	operatorCwd,
	requireManifest,
	type LoadedManifest,
} from '../../../../src/lib/index.js';

export { operatorCwd };

export function errJson(err: unknown, status = 400): Response {
	return json({ error: err instanceof Error ? err.message : String(err) }, { status });
}

export async function loadOptional(): Promise<LoadedManifest | null> {
	return findManifest(operatorCwd());
}

export async function loadRequired(): Promise<LoadedManifest> {
	return requireManifest(operatorCwd());
}

export async function withLockAt<T>(
	root: string,
	fn: () => Promise<T>,
	opts?: { allowInDemo?: boolean },
): Promise<T> {
	if (!opts?.allowInDemo) assertDemoAllowsRepoWrite();
	const lock = await acquireJobLock(root);
	try {
		return await fn();
	} finally {
		await lock.release();
	}
}

export async function withJobLock<T>(fn: (loaded: LoadedManifest) => Promise<T>): Promise<T> {
	const loaded = await loadRequired();
	return withLockAt(loaded.workspaceRoot, () => fn(loaded));
}
