import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { familyRole, familyStem, groupIdsByFamily } from './family.js';

describe('familyStem', () => {
	it('strips one suffix then folds hyphens', () => {
		assert.equal(familyStem('dictawhisper-api'), 'dictawhisper');
		assert.equal(familyStem('temper-pass'), 'temperpass');
		assert.equal(familyStem('temperpass-site'), 'temperpass');
		assert.notEqual(familyStem('file'), familyStem('filepress'));
		assert.equal(familyRole('dictawhisper-site'), 'site');
	});

	it('groups ids by stem', () => {
		const groups = groupIdsByFamily(['dictawhisper', 'dictawhisper-api', 'filepress']);
		assert.deepEqual(groups.get('dictawhisper'), ['dictawhisper', 'dictawhisper-api']);
		assert.deepEqual(groups.get('filepress'), ['filepress']);
	});
});
