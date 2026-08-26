import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { applyPublish, npmWhoami, planPublish, publishAuthHintFor, requirePublishIds } from '../../../../../src/lib/index.js';
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
		const rows = body.apply
			? await withLockAt(loaded.workspaceRoot, async () => {
					const out = [];
					for (const row of planned) {
						const next = await applyPublish(loaded, row, { otp: body.otp });
						out.push(next);
						if (row.action === 'publish' && !next.reason?.startsWith('published ')) break;
					}
					return out;
				})
			: planned;
		const npmUser = body.apply ? undefined : npmWhoami();
		return json({
			rows,
			writes: Boolean(body.apply),
			npmUser,
			authHint: body.apply ? undefined : publishAuthHintFor(npmUser),
		});
	} catch (err) {
		return errJson(err);
	}
};
