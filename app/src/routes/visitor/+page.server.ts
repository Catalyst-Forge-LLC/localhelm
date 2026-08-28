import type { PageServerLoad } from './$types';
import { loadVisitorPage } from '$lib/server/visitorPage';

export const load: PageServerLoad = async ({ request }) => {
	return loadVisitorPage(request.headers.get('host'));
};
