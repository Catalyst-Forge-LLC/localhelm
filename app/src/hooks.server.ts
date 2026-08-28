import { json } from '@sveltejs/kit';
import type { Handle } from '@sveltejs/kit';
import { isOperatorFace } from '../../src/lib/loopback.js';

const OPEN_API = new Set(['/api/visitor']);

export const handle: Handle = async ({ event, resolve }) => {
	const path = event.url.pathname;
	if (path.startsWith('/api/') && !OPEN_API.has(path)) {
		if (!isOperatorFace(event.getClientAddress(), event.request.headers.get('host'))) {
			return json({ error: 'This API is for the operator board on loopback.' }, { status: 403 });
		}
	}
	return resolve(event);
};
