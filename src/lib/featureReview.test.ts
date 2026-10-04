import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { featureReviewConfirm } from './featureReview.js';

describe('featureReviewConfirm', () => {
	it('starts candidates unchecked and names them', () => {
		const spec = featureReviewConfirm('localhelm', {
			features: [
				{ id: 'cmd-push', name: 'Push', recognition: 'candidate', selected: false, summary: 'Candidate. Not on the label.' },
				{ id: 'cmd-scan', name: 'Scan', recognition: 'confirmed', selected: true, summary: 'Confirmed. On the label.' },
			],
		});
		assert.deepEqual(spec.itemLabels, ['Push', 'Scan']);
		assert.deepEqual(spec.itemKeys, ['cmd-push', 'cmd-scan']);
		assert.deepEqual(spec.excludedIds, ['cmd-push']);
		assert.equal(spec.canApply, true);
		assert.match(spec.hint, /up to 12/);
	});

	it('says to scan when the register has no capabilities', () => {
		const spec = featureReviewConfirm('localhelm', { features: [] });
		assert.equal(spec.canApply, false);
		assert.match(spec.hint, /Scan this repo first/);
	});
});
