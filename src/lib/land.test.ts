import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
	companionIdForSite,
	landPluginApplyOk,
	landWouldPublish,
	requireLandSiteId,
	requireLandSiteIds,
	LAND_ENGINE_ID,
} from './land.js';
import { landConfirmItems } from './landDisplay.js';
import { shipUnchanged } from './landShips.js';
import type { ProjectStatus } from './types.js';

function project(partial: Partial<ProjectStatus> & Pick<ProjectStatus, 'id'>): ProjectStatus {
	return {
		path: partial.path ?? partial.id,
		absPath: partial.absPath ?? `Z:/workspace/${partial.id}`,
		missing: false,
		localVersion: '1.0.1',
		private: false,
		unpublishedAhead: false,
		cascadeBehind: 0,
		npm: { name: partial.id, latest: '1.0.0', status: 'ok' },
		git: {
			repo: true,
			dirty: false,
			staged: 0,
			unstaged: 0,
			untracked: 0,
			ahead: 0,
			behind: 0,
			branch: 'main',
			origin: 'https://example.com/x.git',
		},
		pins: [],
		...partial,
	};
}

describe('companionIdForSite', () => {
	it('maps aibreze-site to aibreze', () => {
		assert.equal(companionIdForSite('aibreze-site', ['aibreze', 'filepress', 'ollanet']), 'aibreze');
	});

	it('matches an exact fleet id', () => {
		assert.equal(companionIdForSite('dictawhisper', ['dictawhisper', 'filepress']), 'dictawhisper');
	});

	it('skips the engine id so filepress is not double-planned as companion', () => {
		assert.equal(companionIdForSite('filepress-site', ['filepress', 'aibreze'], LAND_ENGINE_ID), null);
		assert.equal(companionIdForSite('filepress', ['filepress', 'aibreze'], LAND_ENGINE_ID), null);
	});

	it('returns null when nothing matches', () => {
		assert.equal(companionIdForSite('orphan-site', ['aibreze', 'filepress']), null);
	});
});

describe('requireLandSiteId', () => {
	it('requires a named site', () => {
		assert.throws(() => requireLandSiteId(''), /name the FilePress site/);
		assert.throws(() => requireLandSiteId('   '), /name the FilePress site/);
		assert.equal(requireLandSiteId(' aibreze-site '), 'aibreze-site');
	});

	it('requires named ids and prefixes confirm lines when landing more than one', () => {
		assert.throws(() => requireLandSiteIds([]), /name the FilePress site/);
		assert.deepEqual(requireLandSiteIds([' aibreze ', 'dictawhisper', 'aibreze']), ['aibreze', 'dictawhisper']);
		const lined = landConfirmItems([
			{ siteId: 'aibreze', steps: [{ label: 'Sync' }, { label: 'Ship' }] },
			{ siteId: 'dictawhisper', steps: [] },
		]);
		assert.deepEqual(lined.items, ['aibreze  Sync', 'aibreze  Ship', 'dictawhisper  already current']);
		assert.deepEqual(lined.keys, ['aibreze', 'aibreze', 'dictawhisper']);
	});
});

describe('landWouldPublish', () => {
	it('only when unpublished-ahead and publishable', () => {
		assert.equal(landWouldPublish(project({ id: 'pkg', unpublishedAhead: true })), true);
		assert.equal(landWouldPublish(project({ id: 'pkg', unpublishedAhead: false })), false);
		assert.equal(
			landWouldPublish(
				project({
					id: 'dirty',
					unpublishedAhead: true,
					git: {
						repo: true,
						dirty: true,
						staged: 0,
						unstaged: 1,
						untracked: 0,
						ahead: 0,
						behind: 0,
						branch: 'main',
						origin: 'https://example.com/x.git',
					},
				}),
			),
			false,
		);
	});
});

describe('landPluginApplyOk', () => {
	it('fails when any plugin result is not ok', () => {
		assert.equal(landPluginApplyOk({ results: [{ id: 'a', ok: true }] }).ok, true);
		const failed = landPluginApplyOk({
			results: [
				{ id: 'aibreze-site', ok: false },
			],
			log: ['aibreze-site push failed'],
		});
		assert.equal(failed.ok, false);
		assert.match(failed.reason, /push failed|plugin failed/);
	});
});

describe('shipUnchanged', () => {
	it('skips ship only when fingerprints match', () => {
		assert.equal(shipUnchanged('abc:def', 'abc:def'), true);
		assert.equal(shipUnchanged('abc:def', 'abc:xyz'), false);
		assert.equal(shipUnchanged(null, 'abc:def'), false);
		assert.equal(shipUnchanged('abc:def', null), false);
	});
});
