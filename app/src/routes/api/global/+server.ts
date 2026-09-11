import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { applyGlobalInstall, planGlobalInstall, requireGlobalIds } from '../../../../../src/lib/index.js';
import { errJson, loadRequired, withLockAt } from '$lib/server/helm';

export const POST: RequestHandler = async ({ request }) => {
	try {
		const body = (await request.json().catch(() => ({}))) as {
			apply?: boolean;
			ids?: string[];
			versions?: Record<string, string>;
		};
		const loaded = await loadRequired();
		const ids = body.apply ? requireGlobalIds(body.ids ?? []) : body.ids?.length ? body.ids : undefined;
		const planned = await planGlobalInstall(loaded, ids, undefined, body.versions);
		const rows = body.apply
			? await withLockAt(loaded.workspaceRoot, async () => {
					const out = [];
					for (const row of planned) {
						out.push(await applyGlobalInstall(row));
					}
					return out;
				})
			: planned;
		return json({ rows, writes: Boolean(body.apply) });
	} catch (err) {
		return errJson(err);
	}
};
