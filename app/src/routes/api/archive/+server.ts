import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { archiveIds, planArchive, readArchive, restoreIds } from '../../../../../src/lib/index.js';
import { errJson, loadOptional, operatorCwd } from '$lib/server/helm';

async function archiveRoot(): Promise<string> {
	const loaded = await loadOptional();
	return loaded?.workspaceRoot ?? operatorCwd();
}

export const GET: RequestHandler = async () => {
	try {
		return json(await readArchive(await archiveRoot()));
	} catch (err) {
		return errJson(err);
	}
};

export const POST: RequestHandler = async ({ request }) => {
	try {
		const body = (await request.json().catch(() => ({}))) as {
			ids?: unknown;
			restore?: unknown;
			apply?: unknown;
		};
		const ids = Array.isArray(body.ids) ? body.ids.filter((id): id is string => typeof id === 'string') : [];
		if (!ids.length) return errJson(new Error('ids required'));
		const root = await archiveRoot();
		const restore = Boolean(body.restore);
		if (body.apply === false) {
			return json({ rows: await planArchive(root, ids, restore), writes: false });
		}
		const file = restore ? await restoreIds(root, ids) : await archiveIds(root, ids);
		return json(file);
	} catch (err) {
		return errJson(err);
	}
};
