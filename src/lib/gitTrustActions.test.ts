import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { DashboardJobHost } from './dashboardJob.js';
import { createFleetWrites } from './fleetWriteActions.js';
import { GIT_TRUST_HINT } from './gitTrustDisplay.js';
import type { ConfirmOffer } from './writeConfirm.js';

describe('Git trust confirmation', () => {
	it('does not apply before confirmation, then uses the displayed path and refreshes only that row', async () => {
		const calls: { url: string; body: unknown }[] = [];
		const reloads: unknown[] = [];
		let offer: ConfirmOffer | undefined;
		let complete!: () => void;
		const applied = new Promise<void>((resolve) => { complete = resolve; });
		const host = {
			readyNamed: (ids: string[]) => ids,
			call: async (url: string, init: RequestInit) => {
				const body = JSON.parse(String(init.body));
				calls.push({ url, body });
				return { id: 'widget', action: 'trust', directory: '/checkout with spaces', writes: body.apply };
			},
			run: async (_label: string, fn: () => Promise<void>) => { await fn(); },
			note: () => {},
			offerConfirm: (spec: ConfirmOffer) => { offer = spec; },
			reloadAfterWrite: async (ids: string[], mode: string) => { reloads.push({ ids, mode }); complete(); },
		} as unknown as DashboardJobHost;
		await createFleetWrites(host).startGitTrust('widget');
		assert.deepEqual(calls, [{ url: '/api/git-trust', body: { id: 'widget', apply: false } }]);
		assert.deepEqual(offer?.items, ['/checkout with spaces']);
		assert.equal(offer?.hint, GIT_TRUST_HINT);
		assert.equal(offer?.canApply, true);
		offer?.run?.([]);
		assert.equal(calls.length, 1, 'An excluded/canceled confirmation does not write');
		offer?.run?.(['widget']);
		await applied;
		assert.deepEqual(calls[1], { url: '/api/git-trust', body: { id: 'widget', directory: '/checkout with spaces', apply: true } });
		assert.deepEqual(reloads, [{ ids: ['widget'], mode: 'git' }]);
	});

	it('cannot apply when the server reports no ownership repair is needed', async () => {
		let offer: ConfirmOffer | undefined;
		const host = {
			readyNamed: (ids: string[]) => ids,
			call: async () => ({ id: 'widget', action: 'skip', reason: 'Git already reads this directory' }),
			run: async (_label: string, fn: () => Promise<void>) => { await fn(); },
			note: () => {}, offerConfirm: (spec: ConfirmOffer) => { offer = spec; },
		} as unknown as DashboardJobHost;
		await createFleetWrites(host).startGitTrust('widget');
		assert.equal(offer?.canApply, false);
		assert.deepEqual(offer?.applyIds, []);
		assert.equal(offer?.hint, 'Git already reads this directory');
	});
});
