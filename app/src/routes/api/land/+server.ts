import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import {
	applyLandBatch,
	beginLandStopScope,
	clearLandStop,
	finishLandStopScope,
	landRequestSiteIds,
	landStopRequested,
	landStopWanted,
	npmWhoami,
	planLandMany,
	publishAuthHintFor,
	requestLandStop,
} from '../../../../../src/lib/index.js';
import { errJson, loadRequired, withLockAt } from '$lib/server/helm';

export const POST: RequestHandler = async ({ request }) => {
	try {
		const body = (await request.json().catch(() => ({}))) as {
			apply?: boolean;
			stop?: boolean;
			siteId?: string;
			siteIds?: string[];
			otp?: string;
		};
		if (body.stop) {
			const loaded = await loadRequired();
			await requestLandStop(loaded.workspaceRoot);
			return json({ ok: true, stopped: true });
		}
		const siteIds = landRequestSiteIds(body);
		const loaded = await loadRequired();
		if (!body.apply) {
			const plans = await planLandMany(loaded, siteIds);
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

		beginLandStopScope();
		let handedOff = false;
		try {
			const plans = await planLandMany(loaded, siteIds);
			const stream = new ReadableStream({
				async start(controller) {
					const enc = new TextEncoder();
					const send = (obj: unknown): void => {
						controller.enqueue(enc.encode(`${JSON.stringify(obj)}\n`));
					};
					let scopeOpen = true;
					try {
						const batch = await withLockAt(loaded.workspaceRoot, async () => {
							try {
								if (!landStopWanted()) await clearLandStop(loaded.workspaceRoot);
								return await applyLandBatch(loaded, plans, {
									otp: body.otp,
									onStep: (event) => send({ type: 'step', ...event }),
									onIdle: (id) => send({ type: 'step', id, index: -1, status: 'done' }),
									shouldStop: () => landStopRequested(loaded.workspaceRoot),
								});
							} finally {
								await finishLandStopScope(loaded.workspaceRoot);
								scopeOpen = false;
							}
						});
						send({
							type: 'result',
							plans,
							results: batch.results,
							result: batch.results[0],
							stopped: batch.stopped,
							writes: true,
						});
					} catch (err) {
						send({
							type: 'error',
							error: err instanceof Error ? err.message : String(err),
						});
					} finally {
						if (scopeOpen) await finishLandStopScope(loaded.workspaceRoot);
						controller.close();
					}
				},
			});
			handedOff = true;
			return new Response(stream, {
				headers: {
					'content-type': 'application/x-ndjson; charset=utf-8',
					'cache-control': 'no-store',
				},
			});
		} catch (err) {
			if (!handedOff) await finishLandStopScope(loaded.workspaceRoot);
			throw err;
		}
	} catch (err) {
		return errJson(err);
	}
};
