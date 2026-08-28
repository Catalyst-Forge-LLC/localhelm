import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { applyConfirmStep, emptyConfirmPhases, markConfirmKey } from './confirmProgress.js';

describe('confirmProgress', () => {
	it('ticks pull/push rows by id', () => {
		const keys = ['aibreze', 'localslip'];
		let phases = emptyConfirmPhases(2);
		phases = markConfirmKey(keys, phases, 'aibreze', 'current');
		assert.deepEqual(phases, ['current', 'pending']);
		phases = markConfirmKey(keys, phases, 'aibreze', 'done');
		phases = markConfirmKey(keys, phases, 'localslip', 'current');
		assert.deepEqual(phases, ['done', 'current']);
	});

	it('maps a publish step event onto id:index keys', () => {
		const keys = ['aibreze:0', 'aibreze:1', 'aibreze:2'];
		let phases = emptyConfirmPhases(3);
		phases = applyConfirmStep(keys, phases, { id: 'aibreze', index: 0, status: 'start' });
		assert.deepEqual(phases, ['current', 'pending', 'pending']);
		phases = applyConfirmStep(keys, phases, { id: 'aibreze', index: 0, status: 'done' });
		phases = applyConfirmStep(keys, phases, { id: 'aibreze', index: 1, status: 'start' });
		assert.deepEqual(phases, ['done', 'current', 'pending']);
		phases = applyConfirmStep(keys, phases, { id: 'aibreze', index: 1, status: 'fail' });
		assert.deepEqual(phases, ['done', 'fail', 'pending']);
	});
});
