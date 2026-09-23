import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { deleteGroup, readGroups, saveGroup } from '../../../../../src/lib/index.js';
import { errJson, loadOptional, operatorCwd } from '$lib/server/helm';

async function groupsRoot(): Promise<string> {
	const loaded = await loadOptional();
	return loaded?.workspaceRoot ?? operatorCwd();
}

export const GET: RequestHandler = async () => {
	try {
		return json(await readGroups(await groupsRoot()));
	} catch (err) {
		return errJson(err);
	}
};

export const POST: RequestHandler = async ({ request }) => {
	try {
		const body = (await request.json().catch(() => ({}))) as {
			name?: unknown;
			ids?: unknown;
			delete?: unknown;
		};
		const name = typeof body.name === 'string' ? body.name : '';
		const root = await groupsRoot();
		if (body.delete) return json(await deleteGroup(root, name));
		const ids = Array.isArray(body.ids) ? body.ids.filter((id): id is string => typeof id === 'string') : [];
		return json(await saveGroup(root, name, ids));
	} catch (err) {
		return errJson(err);
	}
};
