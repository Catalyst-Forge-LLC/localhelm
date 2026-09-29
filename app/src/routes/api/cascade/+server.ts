import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { applyCascade, planCascade } from '../../../../../src/lib/index.js';
import { errJson, loadRequired, withLockAt } from '$lib/server/helm';

export const POST: RequestHandler = async ({ request }) => {
	try {
		const body = (await request.json()) as {
			id?: string;
			to?: string;
			apply?: boolean;
			commit?: boolean;
			refresh?: boolean;
			progress?: boolean;
		};
		if (!body.id) return errJson('id required');
		const loaded = await loadRequired();
		const planOpts = {
			to: body.to,
			commit: body.commit !== false,
			refresh: body.refresh === true,
		};
		if (!body.apply) return json({ ...(await planCascade(loaded, body.id, planOpts)), writes: false });
		if (!body.progress) {
			const plan = await planCascade(loaded, body.id, planOpts);
			return json(await withLockAt(loaded.workspaceRoot, () => applyCascade(plan)));
		}

		const stream = new ReadableStream({
			async start(controller) {
				const enc = new TextEncoder();
				const send = (obj: unknown): void => {
					controller.enqueue(enc.encode(`${JSON.stringify(obj)}\n`));
				};
				try {
					const applied = await withLockAt(loaded.workspaceRoot, async () => {
						const plan = await planCascade(loaded, body.id as string, planOpts);
						return applyCascade(plan, {
							onProject: (event) => send({ type: 'project', ...event }),
						});
					});
					send({ type: 'result', ...applied });
				} catch (err) {
					send({ type: 'error', error: err instanceof Error ? err.message : String(err) });
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
