import { json } from '@sveltejs/kit';
import path from 'node:path';
import type { RequestHandler } from './$types';
import { resolveUserPath, scanFolders } from '../../../../../src/lib/index.js';
import { errJson, operatorCwd } from '$lib/server/helm';

export const POST: RequestHandler = async ({ request }) => {
	try {
		const body = (await request.json()) as { roots?: string[]; maxDepth?: number };
		const cwd = operatorCwd();
		const roots = body.roots?.length ? body.roots : [cwd];
		const candidates = await scanFolders({ roots, cwd, maxDepth: body.maxDepth });
		const hint = roots.length === 1 ? resolveUserPath(roots[0], cwd) : cwd;
		return json({
			candidates: candidates.map((row) => ({
				...row,
				absPath: path.isAbsolute(row.path) ? row.path : resolveUserPath(row.path, hint),
			})),
		});
	} catch (err) {
		return errJson(err);
	}
};
