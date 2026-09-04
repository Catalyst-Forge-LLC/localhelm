import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { fleetRoster, readArchive } from '../../../../../src/lib/index.js';
import { errJson, loadOptional, operatorCwd } from '$lib/server/helm';

export const GET: RequestHandler = async () => {
	try {
		const loaded = await loadOptional();
		const cwd = operatorCwd();
		if (!loaded) {
			return json({
				projects: [],
				archivedIds: (await readArchive(cwd)).ids,
				workspaceRoot: null,
				manifestPath: null,
				scanRoot: cwd,
				cwd,
			});
		}
		const archived = await readArchive(loaded.workspaceRoot);
		return json({
			projects: fleetRoster(loaded.manifest.projects),
			archivedIds: archived.ids,
			workspaceRoot: loaded.workspaceRoot,
			manifestPath: loaded.manifestPath,
			scanRoot: loaded.workspaceRoot,
			cwd,
		});
	} catch (err) {
		return errJson(err);
	}
};
