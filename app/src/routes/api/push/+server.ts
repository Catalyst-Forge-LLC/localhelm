import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { applyPush, planPush, requirePushIds } from '../../../../../src/lib/index.js';
import { errJson, loadRequired, withLockAt } from '$lib/server/helm';

export const POST: RequestHandler = async ({ request }) => {
	try {
		const body = (await request.json().catch(() => ({}))) as { apply?: boolean; ids?: string[] };
		const loaded = await loadRequired();
		const ids = body.apply ? requirePushIds(body.ids ?? []) : body.ids?.length ? body.ids : undefined;
		const planned = await planPush(loaded, ids);
		const rows = body.apply
			? await withLockAt(loaded.workspaceRoot, async () => planned.map((row) => applyPush(loaded.workspaceRoot, row)))
			: planned;
		return json({ rows, writes: Boolean(body.apply) });
	} catch (err) {
		return errJson(err);
	}
};
