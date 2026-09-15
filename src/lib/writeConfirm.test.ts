import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
	dirtPlanLine,
	firstPlanReason,
	githubPendingRows,
	planOpts,
	pluginJobHint,
	publishItemKeys,
	publishItems,
	pushItems,
	slimPublishRows,
} from './writeConfirm.js';

describe('dirtPlanLine', () => {
	it('marks skips, renames, and ordinary paths', () => {
		assert.equal(dirtPlanLine({ path: 'secret.env', code: '??', skip: 'secret' }), 'skip  secret.env  (secret)');
		assert.equal(dirtPlanLine({ path: 'b.ts', from: 'a.ts', code: 'R' }), 'R  a.ts → b.ts');
		assert.equal(dirtPlanLine({ path: 'src.ts', code: 'M' }), 'M  src.ts');
		assert.equal(dirtPlanLine({ path: 'new.ts', code: '  ' }), '??  new.ts');
	});
});

describe('pushItems', () => {
	it('shows skip reasons and origin ahead lines', () => {
		assert.deepEqual(
			pushItems([
				{ id: 'skip-me', action: 'skip', reason: 'not ahead' },
				{ id: 'helm', action: 'push', ahead: 2, branch: 'main', origin: 'https://example.com/helm.git' },
			]),
			[
				'skip-me  not ahead',
				'helm  main  2 commit(s)\n→  https://example.com/helm.git',
			],
		);
	});
});

describe('publishItems', () => {
	it('prefixes the fleet id only when several packages are listed', () => {
		const row = {
			id: 'helm',
			version: '0.1.20',
			steps: [
				{ kind: 'publish' as const, name: 'localhelm', version: '0.1.20' },
			],
		};
		assert.deepEqual(publishItems(row, false), ['1. npm publish localhelm@0.1.20']);
		assert.deepEqual(publishItems(row, true), ['helm  1. npm publish localhelm@0.1.20']);
		assert.deepEqual(publishItemKeys(row), ['helm:0']);
	});
});

describe('githubPendingRows', () => {
	it('keeps leftover GitHub Publish links', () => {
		const plan = [
			{
				id: 'helm',
				npm: 'localhelm',
				version: '0.1.20',
				steps: [
					{
						kind: 'github' as const,
						name: 'localhelm',
						version: '0.1.20',
						url: 'https://github.com/ex/helm/actions',
						workflow: 'publish.yml',
					},
				],
			},
		];
		assert.deepEqual(githubPendingRows(plan, ['helm']), [
			{
				id: 'helm',
				action: 'publish',
				version: '0.1.20',
				npm: 'localhelm',
				reason: 'open GitHub Publish localhelm@0.1.20  https://github.com/ex/helm/actions',
			},
		]);
		assert.deepEqual(githubPendingRows(plan, []), []);
	});
});

describe('slimPublishRows', () => {
	it('drops steps from the activity payload', () => {
		assert.deepEqual(slimPublishRows([{ id: 'helm', action: 'publish', version: '0.1.20', reason: 'published 0.1.20' }]), [
			{ id: 'helm', action: 'publish', version: '0.1.20', reason: 'published 0.1.20' },
		]);
	});
});

describe('pluginJobHint', () => {
	it('explains localslip skips and FilePress-style push', () => {
		assert.match(
			pluginJobHint('localslip', 'start', [], null, { rows: [{ reason: 'no recipe for lease' }] }),
			/Start needs a folder/,
		);
		assert.equal(
			pluginJobHint('localslip', 'start', [], null, { rows: [{ reason: 'already listening' }] }),
			'Already running on this lease.',
		);
		assert.equal(pluginJobHint('filepress', 'sync', [], ['a']), 'Already current — nothing to write.');
		assert.equal(pluginJobHint('filepress', 'push', ['a'], ['a']), 'git push origin <branch> only. Never --force. Never the IngotVault backup remote.');
		assert.match(pluginJobHint('xfacts', 'ship', ['a'], ['a']), /Not FilePress Land/);
	});
});

describe('firstPlanReason / planOpts', () => {
	it('reads the first row reason and opens confirm without closing', () => {
		assert.equal(firstPlanReason({ rows: [{ reason: 'dirty' }] }), 'dirty');
		assert.equal(firstPlanReason({}), '');
		assert.deepEqual(planOpts('Push', ['helm']), {
			closeConfirm: false,
			openConfirm: { title: 'Push', itemKeys: ['helm'] },
		});
		assert.deepEqual(planOpts('Pull'), { closeConfirm: false, openConfirm: { title: 'Pull' } });
	});
});
