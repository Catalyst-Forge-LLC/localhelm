import { json } from '@sveltejs/kit';
import path from 'node:path';
import type { RequestHandler } from './$types';
import { applyEnroll, enrollFilepressFromFleet, findManifest, planEnroll } from '../../../../../src/lib/index.js';
import { errJson, operatorCwd, withLockAt } from '$lib/server/helm';

export const POST: RequestHandler = async ({ request }) => {
	try {
		const body = (await request.json()) as { paths?: string[]; npm?: string; group?: string; apply?: boolean };
		if (!body.paths?.length) return errJson('paths required');
		const cwd = operatorCwd();
		const existing = await findManifest(cwd);
		const plan = await planEnroll({ paths: body.paths, npm: body.npm, group: body.group, cwd }, existing);
		if (body.apply) {
			const root = existing?.workspaceRoot ?? path.dirname(plan.manifestPath);
			await withLockAt(
				root,
				async () => {
					const manifest = await applyEnroll(plan, existing);
					plan.writes = true;
					if (existing) {
						const addedAbs = plan.rows
							.filter((row) => row.action === 'add')
							.map((row) => path.resolve(existing.workspaceRoot, row.path));
						plan.filepress = await enrollFilepressFromFleet({ ...existing, manifest }, addedAbs);
					}
				},
				{ allowInDemo: true },
			);
		}
		return json(plan);
	} catch (err) {
		return errJson(err);
	}
};
