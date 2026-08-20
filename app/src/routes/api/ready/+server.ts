import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { fleetReady, fleetStatus } from '../../../../../src/lib/index.js';
import { errJson, loadRequired } from '$lib/server/helm';

export const GET: RequestHandler = async () => {
	try {
		const loaded = await loadRequired();
		const inventory = await fleetStatus(loaded);
		return json(fleetReady(inventory));
	} catch (err) {
		return errJson(err);
	}
};
