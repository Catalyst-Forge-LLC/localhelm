import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { applyConfirmStep, commitDraftProgressHint, emptyConfirmPhases, markConfirmKey } from './confirmProgress.js';

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

	it('keeps Asking Ollama up until the last draft, then summarizes', () => {
		const ids = ['coldeye', 'engram', 'x-facts'];
		assert.equal(
			commitDraftProgressHint({ ids, pending: ids }),
			'Asking Ollama… 1 of 3 (coldeye). One at a time.',
		);
		assert.equal(
			commitDraftProgressHint({ ids, pending: ['engram', 'x-facts'] }),
			'Asking Ollama… 2 of 3 (engram). One at a time.',
		);
		assert.equal(
			commitDraftProgressHint({ ids, pending: ['x-facts'], selected: 'coldeye' }),
			'Asking Ollama… 3 of 3 (x-facts). One at a time.',
		);
		assert.equal(
			commitDraftProgressHint({ ids, pending: ['x-facts'], selected: 'x-facts' }),
			'Asking Ollama… 3 of 3 (x-facts). One at a time.',
		);
		assert.equal(
			commitDraftProgressHint({
				ids,
				pending: ['engram', 'x-facts'],
				selected: 'x-facts',
			}),
			'Queued for Ollama… 2 of 3 (now engram).',
		);
		assert.equal(
			commitDraftProgressHint({
				ids,
				pending: [],
				notes: {
					coldeye: 'Ollama (gemma4:12b on localhost) drafted this. Edit if you want.',
					engram: 'Ollama (gemma4:12b on localhost) drafted this. Edit if you want.',
					'x-facts': 'Ollama timed out.',
				},
			}),
			'Ollama drafted 2; 1 used a fallback. Edit if you want.',
		);
		assert.equal(
			commitDraftProgressHint({
				ids: ['coldeye'],
				pending: [],
				selected: 'coldeye',
				notes: { coldeye: 'Ollama (gemma4:12b on localhost) drafted this. Edit if you want.' },
			}),
			'Ollama (gemma4:12b on localhost) drafted this. Edit if you want.',
		);
	});
});
