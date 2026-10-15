import assert from 'node:assert/strict';
import { it } from 'node:test';
import type { DashboardJobHost } from './dashboardJob.js';
import { createFleetWrites } from './fleetWriteActions.js';
import type { ConfirmOffer } from './writeConfirm.js';

it('confirms the publishing target and revision before applying, then refreshes metadata and npm', async () => {
	const calls: unknown[] = [];
	const reloads: unknown[] = [];
	let offer: ConfirmOffer | undefined;
	let complete!: () => void;
	const applied = new Promise<void>((resolve) => { complete = resolve; });
	const host = {
		readyNamed: (ids: string[]) => ids,
		run: async (_label: string, fn: () => Promise<void>) => { await fn(); },
		call: async (url: string, init: RequestInit) => {
			const body = JSON.parse(String(init.body));
			calls.push({ url, body });
			return { id: 'demo', file: '/repo with spaces/package.json', name: 'demo-package', version: '1.2.3', from: true, revision: 'a'.repeat(64), action: 'remove', writes: body.apply };
		},
		note: () => {},
		offerConfirm: (spec: ConfirmOffer) => { offer = spec; },
		reloadAfterWrite: async (ids: string[], mode: string) => { reloads.push({ ids, mode }); complete(); },
	} as unknown as DashboardJobHost;
	await createFleetWrites(host).startPackagePrivacy('demo');
	assert.deepEqual(calls, [{ url: '/api/package-privacy', body: { id: 'demo', apply: false } }]);
	assert.equal(offer?.canApply, true);
	assert(offer?.items[0]?.includes('/repo with spaces/package.json'));
	assert(offer?.items[0]?.includes('demo-package @ 1.2.3'));
	assert(offer?.items[0]?.includes('Remove private: true'));
	assert.match(offer?.hint ?? '', /GitHub repository visibility/);
	offer?.run?.([]);
	assert.equal(calls.length, 1);
	offer?.run?.(['demo']);
	await applied;
	assert.deepEqual(calls[1], { url: '/api/package-privacy', body: { id: 'demo', file: '/repo with spaces/package.json', revision: 'a'.repeat(64), apply: true } });
	assert.deepEqual(reloads, [{ ids: ['demo'], mode: 'ready' }]);
});
