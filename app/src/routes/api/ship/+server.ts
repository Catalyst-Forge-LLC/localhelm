import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { applyScriptShip, planScriptShip, requireShipIds } from '../../../../../src/lib/index.js';
import { shipPagesPreflight } from '../../../../../src/lib/pagesProject.js';
import { errJson, loadRequired, withLockAt } from '$lib/server/helm';

export const POST: RequestHandler = async ({ request }) => {
	try {
		const body = (await request.json().catch(() => ({}))) as { apply?: boolean; ids?: string[] };
		const loaded = await loadRequired();
		const ids = body.apply ? requireShipIds(body.ids ?? []) : body.ids?.length ? body.ids : undefined;
		const planned = await planScriptShip(loaded, ids);
		const rows = body.apply
			? await withLockAt(loaded.workspaceRoot, async () => {
					const out = [];
					for (const row of planned) {
						out.push(await applyScriptShip(loaded, row));
					}
					return out;
				})
			: await Promise.all(planned.map(async (row) => ({
				...row,
				...(row.action === 'ship' ? { pages: await shipPagesPreflight(loaded, row.id) } : {}),
			})));
		return json({ rows, writes: Boolean(body.apply) });
	} catch (err) {
		return errJson(err);
	}
};
