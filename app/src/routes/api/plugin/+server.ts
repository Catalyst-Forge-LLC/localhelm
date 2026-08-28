import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import {
	isPluginEnabled,
	landPluginApplyOk,
	loadPlugins,
	readPluginPrefs,
	recordLandShip,
	requirePlugin,
} from '../../../../../src/lib/index.js';
import { errJson, loadRequired, withLockAt } from '$lib/server/helm';

export const POST: RequestHandler = async ({ request }) => {
	try {
		const body = (await request.json()) as {
			id?: string;
			action?: string;
			ids?: string[];
			apply?: boolean;
		};
		if (!body.id || !body.action) return errJson('id and action required');
		const loaded = await loadRequired();
		const plug = requirePlugin(await loadPlugins(loaded), body.id);
		const prefs = await readPluginPrefs(loaded.workspaceRoot);
		if (!isPluginEnabled(body.id, prefs)) {
			return errJson(`plugin ${body.id} is off. Turn it on from the LocalHelm menu.`);
		}
		const ids = body.ids ?? [];
		if (!body.apply) {
			if (!plug.plugin.plan) return errJson(`plugin ${body.id} has no plan`);
			return json(await plug.plugin.plan(body.action, ids));
		}
		if (!plug.plugin.apply) return errJson(`plugin ${body.id} has no apply`);

		const result = await withLockAt(loaded.workspaceRoot, async () => {
			// Capture ship fingerprints before apply (tree usually unchanged by pnpm ship).
			let fingerprints = new Map<string, string>();
			if (body.id === 'filepress' && body.action === 'ship' && plug.plugin.plan) {
				const planned = await plug.plugin.plan('ship', ids);
				const rows = planned && typeof planned === 'object' ? (planned as { rows?: unknown }).rows : null;
				if (Array.isArray(rows)) {
					for (const row of rows) {
						if (!row || typeof row !== 'object') continue;
						const bodyRow = row as { id?: unknown; shipFingerprint?: unknown };
						if (typeof bodyRow.id === 'string' && typeof bodyRow.shipFingerprint === 'string' && bodyRow.shipFingerprint) {
							fingerprints.set(bodyRow.id, bodyRow.shipFingerprint);
						}
					}
				}
			}

			const applied = await plug.plugin.apply!(body.action as string, ids);
			if (body.id === 'filepress' && body.action === 'ship' && landPluginApplyOk(applied).ok) {
				for (const [siteId, fp] of fingerprints) {
					await recordLandShip(loaded.workspaceRoot, siteId, fp);
				}
			}
			return applied;
		});
		return json(result);
	} catch (err) {
		return errJson(err);
	}
};
