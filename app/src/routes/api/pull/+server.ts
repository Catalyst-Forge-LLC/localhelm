import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { applyPull, planPull } from '../../../../../src/lib/index.js';
import { errJson, loadRequired, withLockAt } from '$lib/server/helm';

export const POST: RequestHandler = async ({ request }) => {
	try {
		const body = (await request.json().catch(() => ({}))) as { apply?: boolean };
		const loaded = await loadRequired();
		const planned = await planPull(loaded);
		const rows = body.apply
			? await withLockAt(loaded.workspaceRoot, async () => planned.map((row) => applyPull(loaded.workspaceRoot, row)))
			: planned;
		return json({ rows, writes: Boolean(body.apply) });
	} catch (err) {
		return errJson(err);
	}
};
