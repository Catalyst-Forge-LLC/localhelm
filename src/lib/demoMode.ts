import { AsyncLocalStorage } from 'node:async_hooks';
import path from 'node:path';

function toPosix(input: string): string {
	return input.split('\\').join('/');
}

export const LIVE_MANIFEST_NAME = 'localhelm.fleet.json';
export const DEMO_MANIFEST_NAME = 'localhelm.fleet.demo.json';
export const DEMO_HEADER = 'x-localhelm-demo';

const store = new AsyncLocalStorage<boolean>();

export function envDemoOn(): boolean {
	const value = process.env.LOCALHELM_DEMO?.trim().toLowerCase();
	return value === '1' || value === 'true' || value === 'yes';
}

export function isDemoMode(): boolean {
	return store.getStore() === true || envDemoOn();
}

export function runWithDemo<T>(demo: boolean, fn: () => T): T {
	return store.run(demo, fn);
}

export function requestWantsDemo(headers: Headers, url: URL): boolean {
	if (headers.get(DEMO_HEADER) === '1') return true;
	if (url.searchParams.get('demo') === '1') return true;
	return envDemoOn();
}

export function demoRepoWriteError(): Error {
	return new Error(
		'Demo board: that would change a real repo. Leave demo to commit, publish, push, or Land.',
	);
}

export function assertDemoAllowsRepoWrite(): void {
	if (isDemoMode()) throw demoRepoWriteError();
}

export function helmStateDir(workspaceRoot: string): string {
	return isDemoMode()
		? toPosix(path.join(workspaceRoot, '.localhelm', 'demo'))
		: toPosix(path.join(workspaceRoot, '.localhelm'));
}

export function demoManifestPath(workspaceRoot: string): string {
	return toPosix(path.join(workspaceRoot, DEMO_MANIFEST_NAME));
}

export function activeManifestName(): string {
	return isDemoMode() ? DEMO_MANIFEST_NAME : LIVE_MANIFEST_NAME;
}
