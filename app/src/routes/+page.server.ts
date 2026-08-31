import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { isOperatorFace } from '../../../src/lib/loopback.js';

export const load: PageServerLoad = async ({ getClientAddress, request }) => {
	if (!isOperatorFace(getClientAddress(), request.headers.get('host'))) {
		redirect(302, '/deck');
	}
};
