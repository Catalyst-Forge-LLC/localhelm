import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { applyPackagePrivacy, planPackagePrivacy } from '../../../../../src/lib/index.js';
import { errJson, loadRequired, withLockAt } from '$lib/server/helm';

export const POST: RequestHandler = async ({ request }) => {
	try {
		const body = (await request.json()) as { id?: unknown; private?: unknown; apply?: unknown; file?: unknown; revision?: unknown };
		if (typeof body.id !== 'string' || !body.id.trim()) return errJson('An enrolled project id is required.');
		if (body.private !== undefined) return errJson('This action only removes the private flag.');
		if (body.apply !== undefined && typeof body.apply !== 'boolean') return errJson('apply must be a boolean.');
		const id = body.id;
		const loaded = await loadRequired();
		if (body.apply === true) {
			if (typeof body.file !== 'string' || !body.file || typeof body.revision !== 'string' || !/^[a-f0-9]{64}$/.test(body.revision)) return errJson('The confirmed package file and revision are required.');
			const file = body.file;
			const revision = body.revision;
			return json(await withLockAt(loaded.workspaceRoot, () => applyPackagePrivacy(loaded, id, file, revision)));
		}
		return json({ ...(await planPackagePrivacy(loaded, id)), writes: false });
	} catch (err) {
		return errJson(err);
	}
};
