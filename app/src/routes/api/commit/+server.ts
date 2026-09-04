import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { applyDirtCommit, planDirtCommit, requireCommitIds } from '../../../../../src/lib/index.js';
import { errJson, loadRequired, withLockAt } from '$lib/server/helm';

export const POST: RequestHandler = async ({ request }) => {
	try {
		const body = (await request.json()) as {
			ids?: unknown;
			apply?: unknown;
			suggest?: unknown;
			messages?: unknown;
		};
		const ids = Array.isArray(body.ids) ? body.ids.filter((id): id is string => typeof id === 'string') : [];
		const named = requireCommitIds(ids);
		const loaded = await loadRequired();
		const suggest = body.suggest !== false && body.apply !== true;
		const plan = await planDirtCommit(loaded, named, { suggest });
		const messages =
			body.messages && typeof body.messages === 'object' && !Array.isArray(body.messages)
				? (body.messages as Record<string, unknown>)
				: {};
		if (body.apply === true) {
			const rows = await withLockAt(loaded.workspaceRoot, async () =>
				plan.rows.map((row) => {
					if (row.action !== 'commit') return row;
					const custom = messages[row.id];
					const message = typeof custom === 'string' && custom.trim() ? custom : row.message;
					return applyDirtCommit(loaded, row, message);
				}),
			);
			return json({ rows, writes: rows.some((row) => row.action === 'commit' && !row.reason) });
		}
		return json({ ...plan, writes: false });
	} catch (err) {
		return errJson(err);
	}
};
