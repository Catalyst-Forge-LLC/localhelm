import assert from 'node:assert/strict';
import { it } from 'node:test';
import { createFleetWrites } from './fleetWriteActions.js';
import type { DashboardJobHost } from './dashboardJob.js';
import type { ConfirmOffer } from './writeConfirm.js';

it('Ship offers creation first; cancellation writes nothing; creation and Ship need separate confirms', async () => {
	const calls: { url: string; body: Record<string, unknown> }[] = [];
	const offers: ConfirmOffer[] = [];
	let created = false;
	const plan = { id: 'widget', action: 'create', reason: 'missing', target: {
		directory: '/repos/widget/site', projectName: 'widget', productionBranch: 'main', accountId: 'a'.repeat(32), accountName: 'Example account', wranglerVersion: '4.151.1', revision: 'confirmed-revision',
	} };
	const host = {
		readyNamed: (ids: string[]) => ids,
		run: async (_label: string, fn: () => Promise<void>) => { await fn(); },
		call: async (url: string, init: RequestInit) => {
			const body = JSON.parse(String(init.body));
			calls.push({ url, body });
			if (url === '/api/ship') return { rows: [{ id: 'widget', action: 'ship', dir: 'root', pages: created ? { ...plan, action: 'exists' } : plan }] };
			assert.equal(url, '/api/pages-project');
			assert.equal(body.apply, true);
			assert.equal(body.revision, plan.target.revision);
			created = true;
			return { ...plan, action: 'exists', ok: true, writes: true, reason: 'Created Pages project.' };
		},
		note: () => {}, offerConfirm: (offer: ConfirmOffer) => { offers.push(offer); },
	} as unknown as DashboardJobHost;
	await createFleetWrites(host).startShip(['widget']);
	const first = offers[0]!;
	assert.equal(first.confirmLabel, 'Create Pages project');
	assert(first.items.includes('Account: Example account'));
	assert(first.items.includes('Pages project: widget'));
	assert(first.items.includes('Production branch: main'));
	first.run?.([]);
	assert.equal(calls.length, 1);
	first.run?.(['widget']);
	await new Promise((resolve) => setImmediate(resolve));
	assert.equal(calls.length, 2);
	assert.equal(calls[1]?.body.apply, true);
	assert.equal(calls[1]?.url, '/api/pages-project');
	const next = offers[1]!;
	assert.equal(next.confirmLabel, 'Open Ship plan');
	next.run?.(['widget']);
	await new Promise((resolve) => setImmediate(resolve));
	assert.equal(calls[2]?.url, '/api/ship');
	assert.equal(calls[2]?.body.apply, false);
	assert.equal(offers[2]?.confirmLabel, 'Ship widget');
	assert.equal(calls.filter((c) => c.url === '/api/ship' && c.body.apply).length, 0);
});
it('blocked Pages setup has no create action', async () => {
	let offer: ConfirmOffer | undefined;
	const host = {
		readyNamed: (ids: string[]) => ids,
		run: async (_label: string, fn: () => Promise<void>) => fn(),
		call: async () => ({ id: 'widget', action: 'blocked', reason: 'Sign in first' }),
		note: () => {}, offerConfirm: (spec: ConfirmOffer) => { offer = spec; },
	} as unknown as DashboardJobHost;
	await createFleetWrites(host).startPagesProject('widget');
	assert.equal(offer?.canApply, false);
	assert.deepEqual(offer?.applyIds, []);
});
