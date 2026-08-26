import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import {
	applyLand,
	npmWhoami,
	planLand,
	publishAuthHintFor,
	requireLandSiteId,
} from '../../../../../src/lib/index.js';
import { errJson, loadRequired, withLockAt } from '$lib/server/helm';

export const POST: RequestHandler = async ({ request }) => {
	try {
		const body = (await request.json().catch(() => ({}))) as {
			apply?: boolean;
			siteId?: string;
			otp?: string;
		};
		const siteId = requireLandSiteId(body.siteId);
		const loaded = await loadRequired();
		const plan = await planLand(loaded, siteId);
		if (!body.apply) {
			const npmUser = plan.needsPublish ? npmWhoami() : undefined;
			return json({
				plan,
				writes: false,
				npmUser,
				authHint: plan.needsPublish ? publishAuthHintFor(npmUser) : undefined,
			});
		}
		const result = await withLockAt(loaded.workspaceRoot, () =>
			applyLand(loaded, plan, { otp: body.otp }),
		);
		return json({ plan, result, writes: true });
	} catch (err) {
		return errJson(err);
	}
};
