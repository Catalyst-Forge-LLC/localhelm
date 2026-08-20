import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { applyBump, planBump, type BumpKind } from '../../../../../src/lib/index.js';
import { errJson, loadRequired, withLockAt } from '$lib/server/helm';

const kinds = new Set<BumpKind>(['patch', 'minor', 'major']);

export const POST: RequestHandler = async ({ request }) => {
	try {
		const body = (await request.json()) as { id?: string; kind?: BumpKind; apply?: boolean };
		if (!body.id || !body.kind || !kinds.has(body.kind)) return errJson('id and kind (patch|minor|major) required');
		const loaded = await loadRequired();
		const plan = await planBump(loaded, body.id, body.kind);
		if (body.apply) {
			if (plan.action !== 'bump') throw new Error(plan.reason ?? `cannot bump ${body.id}`);
			await withLockAt(loaded.workspaceRoot, () => applyBump(plan));
		}
		return json({ ...plan, writes: Boolean(body.apply && plan.action === 'bump') });
	} catch (err) {
		return errJson(err);
	}
};
