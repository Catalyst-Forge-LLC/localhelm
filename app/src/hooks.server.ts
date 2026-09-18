import { json } from '@sveltejs/kit';
import type { Handle } from '@sveltejs/kit';
import { requestWantsDemo, runWithDemo } from '../../src/lib/demoMode.js';
import { isOperatorFace, readClientAddress } from '../../src/lib/loopback.js';

const OPEN_API = new Set(['/api/visitor']);

export const handle: Handle = async ({ event, resolve }) => {
	const path = event.url.pathname;
	if (path.startsWith('/api/') && !OPEN_API.has(path)) {
		if (!isOperatorFace(readClientAddress(() => event.getClientAddress()), event.request.headers.get('host'))) {
			return json({ error: 'This API is for the operator board on loopback.' }, { status: 403 });
		}
	}
	const demo = requestWantsDemo(event.request.headers, event.url);
	return runWithDemo(demo, () => resolve(event));
};
