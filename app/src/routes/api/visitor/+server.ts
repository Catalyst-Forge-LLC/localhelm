import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { errJson } from '$lib/server/helm';
import { loadVisitorSnapshot } from '$lib/server/visitorPage';

export const GET: RequestHandler = async () => {
	try {
		return json(await loadVisitorSnapshot());
	} catch (err) {
		return errJson(err);
	}
};
