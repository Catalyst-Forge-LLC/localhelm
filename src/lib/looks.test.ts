import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { portFamilies, portLooks } from './looks.js';

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
	});

	it('does not treat a -site lease as missing when the package is enrolled', () => {
		const looks = portLooks({
			fleetIds: ['finetuna'],
			leaseRows: [{ id: 'finetuna-site', cells: { listening: 'no', recipe: 'pnpm site:dev', cwdOk: 'yes' } }],
		});
		assert.ok(!looks.some((look) => look.kind === 'lease-without-fleet'));
	});
});
