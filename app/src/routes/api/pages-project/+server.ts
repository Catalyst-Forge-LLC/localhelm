import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { applyPagesProject, planPagesProject } from '../../../../../src/lib/pagesProject.js';
import { errJson, loadRequired, withLockAt } from '$lib/server/helm';

export const POST: RequestHandler = async ({ request }) => {
	try {
		const body = await request.json() as { id?: unknown; apply?: unknown; revision?: unknown };
		if (typeof body.id !== 'string' || !body.id.trim()) return errJson('An enrolled project id is required.');
		if (body.apply !== undefined && typeof body.apply !== 'boolean') return errJson('apply must be a boolean.');
		const loaded = await loadRequired();
		const id = body.id;
		if (body.apply === true) {
			if (typeof body.revision !== 'string' || !body.revision) return errJson('The confirmed Pages setup revision is required.');
			const revision = body.revision;
			return json(await withLockAt(loaded.workspaceRoot, () => applyPagesProject(loaded, id, revision)));
		}
		return json({ ...await planPagesProject(loaded, id), writes: false });
	} catch (error) { return errJson(error); }
};
