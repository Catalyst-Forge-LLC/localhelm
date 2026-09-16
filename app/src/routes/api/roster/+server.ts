import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { fleetRoster, readArchive, readLocalOnly } from '../../../../../src/lib/index.js';
import { errJson, loadOptional, operatorCwd } from '$lib/server/helm';

export const GET: RequestHandler = async () => {
	try {
		const loaded = await loadOptional();
		const cwd = operatorCwd();
		if (!loaded) {
			return json({
				projects: [],
				archivedIds: (await readArchive(cwd)).ids,
				localOnlyIds: (await readLocalOnly(cwd)).ids,
				workspaceRoot: null,
				manifestPath: null,
				scanRoot: cwd,
				cwd,
			});
		}
		const [archived, localOnly] = await Promise.all([
			readArchive(loaded.workspaceRoot),
			readLocalOnly(loaded.workspaceRoot),
		]);
		return json({
			projects: fleetRoster(loaded.manifest.projects),
			archivedIds: archived.ids,
			localOnlyIds: localOnly.ids,
			workspaceRoot: loaded.workspaceRoot,
			manifestPath: loaded.manifestPath,
			scanRoot: loaded.workspaceRoot,
			cwd,
		});
	} catch (err) {
		return errJson(err);
	}
};
