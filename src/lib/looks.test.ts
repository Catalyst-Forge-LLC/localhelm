import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { groupPortLooks, lookJump, lookJumpsFor, portFamilies, portLooks } from './looks.js';

describe('port looks and families', () => {
	it('groups a stack and reports listen bits', () => {
		const families = portFamilies({
			fleetIds: ['dictawhisper'],
			leaseRows: [
				{ id: 'dictawhisper', cells: { listening: 'yes', recipe: 'pnpm serve', cwdOk: 'yes' } },
				{ id: 'dictawhisper-api', cells: { listening: 'no', recipe: 'pnpm start', cwdOk: 'yes' } },
				{ id: 'dictawhisper-site', cells: { listening: 'no', recipe: 'pnpm site:dev', cwdOk: 'yes' } },
			],
		});
		assert.equal(families.length, 1);
		assert.equal(families[0]?.label, 'dictawhisper');
		assert.equal(families[0]?.bits, 'UI up · API down · site down');
	});

	it('emits look cards for missing recipe, cwd, split, and enroll/slip diffs', () => {
		const looks = portLooks({
			fleetIds: ['dictawhisper', 'temper-pass'],
			leaseRows: [
				{ id: 'dictawhisper', cells: { listening: 'yes', recipe: 'pnpm serve', cwdOk: 'yes' } },
				{ id: 'dictawhisper-api', cells: { listening: 'no', recipe: '—', cwdOk: '—' } },
				{ id: 'ghost', cells: { listening: 'no', recipe: 'pnpm serve', cwdOk: 'no' } },
			],
		});
		assert.ok(looks.some((look) => look.kind === 'no-recipe' && look.title === 'dictawhisper-api'));
		assert.ok(looks.some((look) => look.kind === 'cwd-missing' && look.title === 'ghost'));
		assert.ok(looks.some((look) => look.kind === 'family-split' && look.detail.includes('API down')));
		assert.ok(looks.some((look) => look.kind === 'lease-without-fleet' && look.title === 'ghost'));
		assert.ok(!looks.some((look) => look.kind === 'lease-without-fleet' && look.title === 'dictawhisper-api'));
		assert.ok(!looks.some((look) => look.kind === 'fleet-without-lease' && look.title === 'temper-pass'));
		assert.ok(!looks.some((look) => look.kind === 'fleet-without-lease' && look.title === 'dictawhisper'));
	});

	it('groups multiple facts for the same lease onto one card', () => {
		const looks = portLooks({
			fleetIds: [],
			leaseRows: [
				{ id: 'acmegeek', cells: { listening: 'no', recipe: '—', cwdOk: 'yes' } },
				{ id: 'ghost', cells: { listening: 'no', recipe: 'pnpm serve', cwdOk: 'yes' } },
			],
		});
		const grouped = groupPortLooks(looks);
		const acme = grouped.find((card) => card.title === 'acmegeek');
		assert.ok(acme);
		assert.ok(acme.details.includes('No start recipe'));
		assert.ok(acme.details.includes('Lease has no matching fleet row'));
		assert.equal(grouped.filter((card) => card.title === 'acmegeek').length, 1);
	});

	it('sends enroll mismatches to Add, not Ports', () => {
		assert.equal(lookJump('lease-without-fleet').id, 'add');
		assert.equal(lookJump('no-recipe').id, 'ports');
		assert.equal(lookJump('family-split').id, 'stacks');
		assert.equal(lookJump('cwd-missing', { enrolled: true }).id, 'fleet');
		assert.equal(lookJump('cwd-missing').id, 'ports');
		assert.equal(lookJump('fleet-without-lease').id, 'claim');
		assert.equal(lookJump('fleet-without-lease').label, 'Lease');
		const mixed = lookJumpsFor(['no-recipe', 'lease-without-fleet']);
		assert.deepEqual(mixed.map((jump) => jump.id), ['ports', 'add']);
	});

	it('does not treat a -site lease as missing when the package is enrolled', () => {
		const looks = portLooks({
			fleetIds: ['finetuna'],
			leaseRows: [{ id: 'finetuna-site', cells: { listening: 'no', recipe: 'pnpm site:dev', cwdOk: 'yes' } }],
		});
		assert.ok(!looks.some((look) => look.kind === 'lease-without-fleet'));
		assert.ok(!looks.some((look) => look.kind === 'fleet-without-lease' && look.title === 'finetuna'));
	});

	it('only nags FilePress / -site ids that have no site slip', () => {
		const looks = portLooks({
			fleetIds: ['detangler', 'acmegeek', 'aegis'],
			siteIds: ['detangler', 'orphan-site', 'coldeye', 'gap-last'],
			leaseRows: [{ id: 'acmegeek', cells: { listening: 'yes', recipe: '—', cwdOk: 'yes' } }],
			claimedIds: ['acmegeek', 'parked-only', 'coldeye-site', 'gaplast-site'],
		});
		const detangler = looks.find((look) => look.kind === 'fleet-without-lease' && look.title === 'detangler');
		assert.ok(detangler);
		assert.equal(detangler.detail, 'Site has no port lease');
		assert.equal(detangler.leaseName, 'detangler-site');
		assert.ok(looks.some((look) => look.kind === 'fleet-without-lease' && look.title === 'orphan-site' && look.leaseName === 'orphan-site'));
		assert.ok(!looks.some((look) => look.title === 'coldeye'));
		assert.ok(!looks.some((look) => look.title === 'gap-last'));
		assert.ok(!looks.some((look) => look.title === 'aegis'));
		assert.ok(!looks.some((look) => look.title === 'acmegeek' && look.kind === 'fleet-without-lease'));
		assert.ok(!looks.some((look) => look.title === 'parked-only'));
	});
});
