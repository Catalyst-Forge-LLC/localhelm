import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { familyMemberNames, familyRole, familyStem, groupIdsByFamily, hasExactOrSiteLease, siteLeaseName } from './family.js';

describe('familyStem', () => {
	it('strips one suffix then folds hyphens', () => {
		assert.equal(familyStem('dictawhisper-api'), 'dictawhisper');
		assert.equal(familyStem('temper-pass'), 'temperpass');
		assert.equal(familyStem('temperpass-site'), 'temperpass');
		assert.notEqual(familyStem('file'), familyStem('filepress'));
		assert.equal(familyRole('dictawhisper-site'), 'site');
	});

	it('lists family members from a seed', () => {
		assert.deepEqual(familyMemberNames('dictawhisper', ['dictawhisper-api', 'filepress', 'dictawhisper-site']), [
			'dictawhisper-api',
			'dictawhisper-site',
		]);
	});

	it('groups ids by stem', () => {
		const groups = groupIdsByFamily(['dictawhisper', 'dictawhisper-api', 'filepress']);
		assert.deepEqual(groups.get('dictawhisper'), ['dictawhisper', 'dictawhisper-api']);
		assert.deepEqual(groups.get('filepress'), ['filepress']);
	});

	it('names the FilePress preview slip', () => {
		assert.equal(siteLeaseName('coldeye'), 'coldeye-site');
		assert.equal(siteLeaseName('coldeye-site'), 'coldeye-site');
		assert.equal(hasExactOrSiteLease('coldeye', ['coldeye-site']), true);
		assert.equal(hasExactOrSiteLease('coldeye', ['coldeye']), true);
		assert.equal(hasExactOrSiteLease('coldeye', ['other-site']), false);
		assert.equal(hasExactOrSiteLease('gap-last', ['gaplast-site']), true);
		assert.equal(hasExactOrSiteLease('temper-pass', ['temperpass-site']), true);
	});
});
