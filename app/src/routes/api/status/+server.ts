import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { fleetStatus, npmWhoami, readLandPendingReasons, readLandPendingSiteIds, readLandShipFingerprints } from '../../../../../src/lib/index.js';
import { errJson, loadOptional, operatorCwd } from '$lib/server/helm';

type Loaded = NonNullable<Awaited<ReturnType<typeof loadOptional>>>;

let lastNpmUser: { user: string; at: number } | null = null;

function peekNpmUser(): string | null {
	return lastNpmUser?.user ?? null;
}

function currentNpmUser(): string | null {
	if (lastNpmUser && Date.now() - lastNpmUser.at < 5 * 60_000) return lastNpmUser.user;
	const user = npmWhoami();
	if (user) lastNpmUser = { user, at: Date.now() };
	return user ?? lastNpmUser?.user ?? null;
}

function listen(): { host: string | null; port: string | null; portSource: string | null } {
	return {
		host: process.env.LOCALHELM_HOST ?? null,
		port: process.env.LOCALHELM_PORT ?? null,
		portSource: process.env.LOCALHELM_PORT_SOURCE ?? null,
	};
}

type StatusBody = {
	inventory: unknown;
	workspaceRoot: string | null;
	scanRoot: string;
	cwd: string;
	fetched?: boolean;
	npmUser: string | null;
	landPending?: string[];
	landPendingReasons?: Record<string, string>;
	landShipFingerprints?: Record<string, string>;
	host: string | null;
	port: string | null;
	portSource: string | null;
};

async function statusBody(
	loaded: Loaded,
	cwd: string,
	opts: {
		fetchRemotes: boolean;
		refreshNpm: boolean;
		gitOnly?: boolean;
		skipCommitCounts?: boolean;
		onlyIds?: string[];
		onProgress?: (progress: { phase: string; label: string; done?: number; total?: number }) => void;
	},
): Promise<StatusBody> {
	const npmUser = opts.gitOnly || opts.skipCommitCounts ? peekNpmUser() : currentNpmUser();
	const landP = readLandPendingSiteIds(loaded.workspaceRoot);
	const reasonsP = readLandPendingReasons(loaded.workspaceRoot);
	const fpsP = readLandShipFingerprints(loaded.workspaceRoot);
	const inventory = await fleetStatus(loaded, {
		fetch: opts.fetchRemotes,
		refreshNpm: opts.refreshNpm,
		onlyIds: opts.onlyIds,
		gitOnly: opts.gitOnly,
		skipCommitCounts: opts.skipCommitCounts,
		npmUser,
		onProgress: opts.onProgress,
	});
	const [landPending, landPendingReasons, landShipFingerprints] = await Promise.all([landP, reasonsP, fpsP]);
	return {
		inventory,
		workspaceRoot: loaded.workspaceRoot,
		scanRoot: loaded.workspaceRoot,
		cwd,
		fetched: opts.fetchRemotes,
		npmUser,
		landPending,
		landPendingReasons,
		landShipFingerprints,
		...listen(),
	};
}

export const GET: RequestHandler = async ({ url }) => {
	try {
		const loaded = await loadOptional();
		const cwd = operatorCwd();
		if (!loaded) {
			return json({
				inventory: null,
				workspaceRoot: null,
				scanRoot: cwd,
				cwd,
				npmUser: currentNpmUser(),
				...listen(),
			});
		}
		const fetchRemotes = url.searchParams.get('fetch') === '1';
		const refreshNpm = url.searchParams.get('fresh') === '1' || fetchRemotes;
		const gitOnly = url.searchParams.get('git') === '1';
		const skipCommitCounts = url.searchParams.get('light') === '1';
		const onlyIds = url.searchParams.get('ids')?.split(',').map((id) => id.trim()).filter(Boolean);
		const opts = {
			fetchRemotes,
			refreshNpm,
			gitOnly,
			skipCommitCounts,
			onlyIds: onlyIds?.length ? onlyIds : undefined,
		};
		if (url.searchParams.get('progress') !== '1') {
			return json(await statusBody(loaded, cwd, opts));
		}

		const stream = new ReadableStream({
			async start(controller) {
				const enc = new TextEncoder();
				const send = (obj: unknown): void => {
					controller.enqueue(enc.encode(`${JSON.stringify(obj)}\n`));
				};
				try {
					const body = await statusBody(loaded, cwd, {
						...opts,
						onProgress: (progress) => send({ type: 'progress', ...progress }),
					});
					send({ type: 'result', ...body });
				} catch (err) {
					send({ type: 'error', error: err instanceof Error ? err.message : String(err) });
				} finally {
					controller.close();
				}
			},
		});
		return new Response(stream, {
			headers: {
				'content-type': 'application/x-ndjson; charset=utf-8',
				'cache-control': 'no-store',
			},
		});
	} catch (err) {
		return errJson(err);
	}
};
