import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { applyGitTrust, planGitTrust } from '../../../../../src/lib/index.js';
import { errJson, loadRequired, withLockAt } from '$lib/server/helm';

export const POST: RequestHandler = async ({ request }) => {
	try {
		const body = (await request.json()) as { id?: unknown; apply?: unknown; directory?: unknown };
		if (typeof body.id !== 'string' || !body.id.trim()) return errJson('An enrolled project id is required.');
		if (body.apply !== undefined && typeof body.apply !== 'boolean') return errJson('apply must be a boolean.');
		const loaded = await loadRequired();
		if (body.apply === true) {
			if (typeof body.directory !== 'string' || !body.directory) return errJson('The confirmed directory is required.');
			const directory = body.directory;
			return json(await withLockAt(loaded.workspaceRoot, () => applyGitTrust(loaded, body.id as string, directory)));
		}
		return json({ ...(await planGitTrust(loaded, body.id)), writes: false });
	} catch (err) {
		return errJson(err);
	}
};
