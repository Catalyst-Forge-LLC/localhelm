import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { applyPublish, npmWhoami, planPublish, publishAuthHintFor, requirePublishIds } from '../../../../../src/lib/index.js';
import { isPublishedReason } from '../../../../../src/lib/writeGate.js';
import type { BumpKind } from '../../../../../src/lib/index.js';
import { errJson, loadRequired, withLockAt } from '$lib/server/helm';

export const POST: RequestHandler = async ({ request }) => {
	try {
		const body = (await request.json().catch(() => ({}))) as {
			apply?: boolean;
			ids?: string[];
			kind?: BumpKind;
			otp?: string;
		};
		const kind: BumpKind = body.kind === 'minor' || body.kind === 'major' ? body.kind : 'patch';
		const loaded = await loadRequired();
		const ids = body.apply ? requirePublishIds(body.ids ?? []) : body.ids?.length ? body.ids : undefined;
		const planned = await planPublish(loaded, ids, kind);
		if (!body.apply) {
			const npmUser = npmWhoami();
			return json({
				rows: planned,
				writes: false,
				npmUser,
				authHint: publishAuthHintFor(npmUser),
			});
		}

		const stream = new ReadableStream({
			async start(controller) {
				const enc = new TextEncoder();
				const send = (obj: unknown): void => {
					controller.enqueue(enc.encode(`${JSON.stringify(obj)}\n`));
				};
				try {
					const rows = await withLockAt(loaded.workspaceRoot, async () => {
						const out = [];
						for (const row of planned) {
							const next = await applyPublish(loaded, row, {
								otp: body.otp,
								onStep: (event) => send({ type: 'step', ...event }),
							});
							out.push(next);
							if (row.action === 'publish' && !isPublishedReason(next.reason)) break;
						}
						return out;
					});
					send({ type: 'result', rows, writes: true });
				} catch (err) {
					send({
						type: 'error',
						error: err instanceof Error ? err.message : String(err),
					});
				} finally {
					controller.close();
				}
			},
		});
		return new Response(stream, {
			headers: {
				'content-type': 'application/x-ndjson; charset=utf-8',
				'cache-control': 'no-store',
			},
		});
	} catch (err) {
		return errJson(err);
	}
};
