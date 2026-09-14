import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
	landApplyTitle,
	landBatchSnap,
	landConfirmItems,
	landResultHint,
	landResultLine,
	landResultPhase,
	landResultTitle,
	landRowFromApply,
	orderLandResults,
} from './landDisplay.js';

describe('land result copy', () => {
	it('summarizes a failed apply into one row', () => {
		const row = landRowFromApply('localslip', {
			ok: false,
			stoppedAt: 'site localslip: sync engine',
			steps: [
				{ ok: false, label: 'site localslip: sync engine', reason: 'ERR_PNPM_UNEXPECTED_VIRTUAL_STORE' },
			],
		});
		assert.equal(row.ok, false);
		assert.match(row.reason ?? '', /sync engine/);
		assert.equal(landResultLine(row), `localslip  ${row.reason}`);
		assert.equal(landResultPhase(row), 'fail');
	});

	it('orders failures first and titles a mixed batch', () => {
		const rows = orderLandResults([
			{ id: 'haulout', ok: true, reason: 'landed' },
			{ id: 'localslip', ok: false, reason: 'sync failed' },
		]);
		assert.deepEqual(
			rows.map((row) => row.id),
			['localslip', 'haulout'],
		);
		assert.equal(landResultTitle(rows), '1 of 2 failed');
		assert.equal(landResultTitle(rows, { interrupted: true }), 'Land interrupted');
		assert.equal(landApplyTitle(rows), 'land --apply — 1 ok, 1 failed: localslip');
		assert.match(landResultHint(rows), /pending on Today Land/);
		assert.equal(landResultLine({ id: 'haulout', ok: true }), 'haulout  landed');
		assert.equal(landConfirmItems([{ siteId: 'x', steps: [] }]).items[0], 'Already current.');
		assert.deepEqual(landBatchSnap(['a', 'b', 'c'], [{ id: 'a', ok: true }]).remaining, ['b', 'c']);
	});
});
