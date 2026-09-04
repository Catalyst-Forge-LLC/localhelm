import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { fleetRoster } from './roster.js';

describe('fleetRoster', () => {
	it('copies id and path and keeps optional npm and group', () => {
		assert.deepEqual(
			fleetRoster([
				{ id: 'localhelm', path: '.', npm: 'localhelm' },
				{ id: 'site-only', path: 'site', group: 'docs' },
			]),
			[
				{ id: 'localhelm', path: '.', npm: 'localhelm' },
				{ id: 'site-only', path: 'site', group: 'docs' },
			],
		);
	});
});
