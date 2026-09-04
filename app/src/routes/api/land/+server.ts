import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import {
	applyLand,
	landRequestSiteIds,
	npmWhoami,
	planLandMany,
	publishAuthHintFor,
} from '../../../../../src/lib/index.js';
import { errJson, loadRequired, withLockAt } from '$lib/server/helm';

export const POST: RequestHandler = async ({ request }) => {
	try {
		const body = (await request.json().catch(() => ({}))) as {
			apply?: boolean;
			siteId?: string;
			siteIds?: string[];
			otp?: string;
		};
		const siteIds = landRequestSiteIds(body);
		const loaded = await loadRequired();
		const plans = await planLandMany(loaded, siteIds);
		if (!body.apply) {
			const needsOtp = plans.some((plan) => plan.needsOtp);
			const npmUser = needsOtp ? npmWhoami() : undefined;
			return json({
				plans,
				plan: plans[0],
				writes: false,
				npmUser,
				authHint: needsOtp ? publishAuthHintFor(npmUser) : undefined,
			});
		}
		const results = await withLockAt(loaded.workspaceRoot, async () => {
			const out = [];
			for (const plan of plans) {
				if (!plan.steps.length) {
					out.push({ siteId: plan.siteId, ok: true, steps: [] });
					continue;
				}
				const result = await applyLand(loaded, plan, { otp: body.otp });
				out.push(result);
				if (!result.ok) break;
			}
			return out;
		});
		return json({ plans, results, result: results[0], writes: true });
	} catch (err) {
		return errJson(err);
	}
};
