import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
	buildConfirmRoster,
	confirmGroupId,
	confirmGroupPhase,
	confirmRosterSelected,
	confirmStepLabel,
} from './confirmRoster.js';

describe('confirmRoster', () => {
	it('groups publish id:index keys and strips the name from the step', () => {
		const groups = buildConfirmRoster(
			['coldeye  1. bump', 'coldeye  2. commit', 'detangler  1. bump'],
			['coldeye:0', 'coldeye:1', 'detangler:0'],
			['done', 'current', 'pending'],
		);
		assert.ok(groups);
		assert.equal(groups.length, 2);
		assert.equal(groups[0]?.id, 'coldeye');
		assert.equal(groups[0]?.phase, 'current');
		assert.deepEqual(
			groups[0]?.steps.map((step) => step.text),
			['1. bump', '2. commit'],
		);
		assert.equal(groups[1]?.phase, 'pending');
		assert.equal(groups[1]?.total, 1);
	});

	it('groups land keys that repeat the site id', () => {
		const groups = buildConfirmRoster(
			['aibreze  Sync', 'aibreze  Ship', 'dictawhisper  already current'],
			['aibreze', 'aibreze', 'dictawhisper'],
		);
		assert.equal(groups?.[0]?.total, 2);
		assert.equal(groups?.[1]?.steps[0]?.text, 'already current');
	});

	it('stays flat for one package or anonymous index keys', () => {
		assert.equal(
			buildConfirmRoster(['1. bump', '2. commit'], ['coldeye:0', 'coldeye:1']),
			null,
		);
		assert.equal(buildConfirmRoster(['hide a', 'hide b'], ['0', '1']), null);
	});

	it('picks fail over current, and pinned over live', () => {
		assert.equal(confirmGroupId('coldeye:3'), 'coldeye');
		assert.equal(confirmStepLabel('coldeye', 'coldeye  1. bump'), '1. bump');
		assert.equal(confirmStepLabel('dictawhisper', 'dictawhisper\npnpm serve'), 'pnpm serve');
		assert.equal(confirmGroupPhase(['done', 'fail', 'current']), 'fail');
		const groups = buildConfirmRoster(
			['a  x', 'b  y'],
			['a', 'b'],
			['done', 'current'],
		);
		assert.ok(groups);
		assert.equal(confirmRosterSelected(groups, null), 'b');
		assert.equal(confirmRosterSelected(groups, 'a'), 'a');
	});
});
