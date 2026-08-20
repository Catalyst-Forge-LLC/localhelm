import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { applyExport, planExport } from '../../../../../src/lib/index.js';
import { errJson, loadRequired, withLockAt } from '$lib/server/helm';

export const POST: RequestHandler = async ({ request }) => {
	try {
		const body = (await request.json().catch(() => ({}))) as { file?: string; apply?: boolean };
		const loaded = await loadRequired();
		const plan = planExport(loaded.workspaceRoot, body.file);
		if (body.apply) {
			await withLockAt(loaded.workspaceRoot, () => applyExport(loaded, plan));
		}
		return json({ ...plan, writes: Boolean(body.apply) });
	} catch (err) {
		return errJson(err);
	}
};
