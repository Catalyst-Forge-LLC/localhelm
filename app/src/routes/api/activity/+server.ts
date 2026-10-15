import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { appendActivitySnapshot, clearActivity, readActivitySnapshot } from '../../../../../src/lib/index.js';
import { errJson, loadOptional, operatorCwd } from '$lib/server/helm';

async function activityRoot(): Promise<string> {
	const loaded = await loadOptional();
	return loaded?.workspaceRoot ?? operatorCwd();
}

export const GET: RequestHandler = async () => {
	try {
		return json(await readActivitySnapshot(await activityRoot()));
	} catch (err) {
		return errJson(err);
	}
};

export const POST: RequestHandler = async ({ request }) => {
	try {
		const body = (await request.json().catch(() => ({}))) as {
			title?: unknown;
			data?: unknown;
			body?: unknown;
			id?: unknown;
			at?: unknown;
			generation?: unknown;
		};
		if (typeof body.title !== 'string') {
			return errJson(new Error('activity title is required'));
		}
		const snapshot = await appendActivitySnapshot(await activityRoot(), {
			id: typeof body.id === 'string' ? body.id : undefined,
			at: typeof body.at === 'string' ? body.at : undefined,
			generation: typeof body.generation === 'string' ? body.generation : undefined,
			title: body.title,
			body: typeof body.body === 'string' ? body.body : undefined,
			data: body.data,
		});
		return json(snapshot);
	} catch (err) {
		return errJson(err);
	}
};

export const DELETE: RequestHandler = async ({ request }) => {
	try {
		const body = await request.json().catch(() => ({})) as { generation?: unknown };
		return json(await clearActivity(await activityRoot(), typeof body.generation === 'string' ? body.generation : undefined));
	} catch (err) {
		return errJson(err);
	}
};
