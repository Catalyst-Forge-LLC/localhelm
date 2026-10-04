import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { featureLabelModel, labelPaperMeta, labelPaperRows, labelTickSeed } from './featureLabel.js';

const payload = {
	features: [
		{ id: 'cmd-push', name: 'Push', recognition: 'candidate', selected: false, summary: 'Candidate.' },
		{ id: 'cmd-scan', name: 'Scan', recognition: 'confirmed', selected: true, summary: 'On the label.' },
	],
	card: {
		name: 'LocalHelm',
		type: 'typescript-node',
		status: 'active',
		rows: [{ name: 'Scan', lifecycle: 'implemented', availability: 'unknown', maturity: 'unknown', evidence: 'current' }],
	},
	check: 'Source fingerprint is stale.\nCheck passed.',
};

describe('featureLabelModel', () => {
	it('keeps the rendered rows and the stale note', () => {
		const model = featureLabelModel('localhelm', payload);
		assert.equal(model.card?.name, 'LocalHelm');
		assert.deepEqual(model.card?.rows.map((row) => row.name), ['Scan']);
		assert.deepEqual(model.notes, ['The repo changed after the last Scan. Scan again to refresh.']);
		assert.equal(model.features.length, 2);
	});

	it('has no card when nothing is selected', () => {
		const model = featureLabelModel('localhelm', {
			features: payload.features,
			card: null,
			check: 'FEATURE_FACTS.md is missing. Run featurefacts report.',
		});
		assert.equal(model.card, null);
		assert.deepEqual(model.notes, []);
	});
});

describe('labelPaperRows', () => {
	it('keeps shared known fields and drops unknown ones', () => {
		assert.deepEqual(
			labelPaperRows([
				{
					name: 'Push',
					lifecycle: 'implemented',
					availability: 'unknown',
					maturity: 'unknown',
					documentation: 'partial',
					tests: 'partial',
					evidence: 'current',
				},
				{
					name: 'Scan',
					lifecycle: 'implemented',
					availability: 'unknown',
					maturity: 'experimental',
					documentation: 'partial',
					tests: 'unknown',
					evidence: 'current',
				},
			]),
			[
				{ label: 'Selected', value: 'Push · Scan' },
				{ label: 'Lifecycle', value: 'implemented' },
				{ label: 'Documentation', value: 'partial' },
				{ label: 'Evidence', value: 'current' },
			],
		);
		assert.deepEqual(labelPaperMeta({ type: 'unknown', status: 'active' }), [{ label: 'Status', value: 'active' }]);
	});
});

describe('labelTickSeed', () => {
	it('keeps ticks that survived a scan', () => {
		const model = featureLabelModel('localhelm', payload);
		assert.deepEqual(labelTickSeed(model.features), ['cmd-scan']);
		assert.deepEqual(labelTickSeed(model.features, ['cmd-push', 'gone']), ['cmd-push']);
	});
});
