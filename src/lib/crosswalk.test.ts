import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { crosswalkChips } from './crosswalk.js';

describe('crosswalkChips', () => {
	it('only names the boards that have this id', () => {
		assert.deepEqual(
			crosswalkChips('aibreze', {
				fleetIds: ['aibreze'],
				siteIds: ['aibreze'],
				leaseIds: ['aibreze-site'],
				hide: 'fleet',
			}),
			[{ kind: 'sites', label: 'Site' }],
		);
		assert.deepEqual(
			crosswalkChips('ghost', { fleetIds: ['aibreze'], siteIds: [], leaseIds: [] }),
			[],
		);
	});
});
