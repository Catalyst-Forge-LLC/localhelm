import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { appendActivity, clearActivity, readActivity } from '../../../../../src/lib/index.js';
import { errJson, loadOptional, operatorCwd } from '$lib/server/helm';

async function activityRoot(): Promise<string> {
	const loaded = await loadOptional();
	return loaded?.workspaceRoot ?? operatorCwd();
}

export const GET: RequestHandler = async () => {
	try {
		const entries = await readActivity(await activityRoot());
		return json({ entries });
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
		};
		if (typeof body.title !== 'string') {
			return errJson(new Error('activity title is required'));
		}
		const entries = await appendActivity(await activityRoot(), {
			title: body.title,
			body: typeof body.body === 'string' ? body.body : undefined,
			data: body.data,
		});
		return json({ entries });
	} catch (err) {
		return errJson(err);
	}
};

export const DELETE: RequestHandler = async () => {
	try {
		await clearActivity(await activityRoot());
		return json({ entries: [] });
	} catch (err) {
		return errJson(err);
	}
};
