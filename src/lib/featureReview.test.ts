import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { featurefactsCheckLines, featureReviewConfirm } from './featureReview.js';

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

describe('featurefactsCheckLines', () => {
	it('turns a stale fingerprint and a schema dump into sentences', () => {
		const lines = featurefactsCheckLines(
			'features.yaml: /features/0/recognition must be equal to constant; /features/0 must match "then" schema\nSource fingerprint is stale.',
		);
		assert.deepEqual(lines, [
			'Some confirmed capabilities are still marked as scan clusters. Update the label again.',
			'The repo changed after the last Scan. Scan again to refresh.',
		]);
	});

	it('does not call a doc-sign schema error a scan cluster', () => {
		const lines = featurefactsCheckLines(
			'features.yaml: /features/0/tests/links must NOT have more than 0 items; /features/0/tests must match "then" schema',
		);
		assert.deepEqual(lines, ['A doc or test sign was saved in a form Check rejects. Scan again to refresh.']);
	});
});
