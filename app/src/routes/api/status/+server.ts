import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { fleetStatus, npmWhoami } from '../../../../../src/lib/index.js';
import { errJson, loadOptional, operatorCwd } from '$lib/server/helm';

let lastNpmUser: { user: string; at: number } | null = null;

function currentNpmUser(): string | null {
	if (lastNpmUser && Date.now() - lastNpmUser.at < 5 * 60_000) return lastNpmUser.user;
	const user = npmWhoami();
	if (user) lastNpmUser = { user, at: Date.now() };
	return user ?? lastNpmUser?.user ?? null;
}

function listen(): { port: string | null; portSource: string | null } {
	return {
		port: process.env.LOCALHELM_PORT ?? null,
		portSource: process.env.LOCALHELM_PORT_SOURCE ?? null,
	};
}

export const GET: RequestHandler = async ({ url }) => {
	try {
		const loaded = await loadOptional();
		const cwd = operatorCwd();
		const npmUserP = Promise.resolve().then(() => currentNpmUser());
		if (!loaded) {
			return json({
				inventory: null,
				workspaceRoot: null,
				scanRoot: cwd,
				cwd,
				npmUser: await npmUserP,
				...listen(),
			});
		}
		const fetchRemotes = url.searchParams.get('fetch') === '1';
		const onlyIds = url.searchParams.get('ids')?.split(',').map((id) => id.trim()).filter(Boolean);
		const [inventory, npmUser] = await Promise.all([
			fleetStatus(loaded, { fetch: fetchRemotes, onlyIds: onlyIds?.length ? onlyIds : undefined }),
			npmUserP,
		]);
		return json({
			inventory,
			workspaceRoot: loaded.workspaceRoot,
			scanRoot: loaded.workspaceRoot,
			cwd,
			fetched: fetchRemotes,
			npmUser,
			...listen(),
		});
	} catch (err) {
		return errJson(err);
	}
};
