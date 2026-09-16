import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, it } from 'node:test';
import {
	clearLocalOnly,
	localOnlyCoversId,
	localOnlyPath,
	markLocalOnly,
	readLocalOnly,
} from './localOnly.js';

describe('localOnlyCoversId', () => {
	it('covers the fleet id and its -site sibling', () => {
		const flagged = new Set(['launch-campaign']);
		assert.equal(localOnlyCoversId('launch-campaign', flagged), true);
		assert.equal(localOnlyCoversId('launch-campaign-site', flagged), true);
		assert.equal(localOnlyCoversId('localhelm', flagged), false);
	});

	it('does not mark the fleet row when only the site is local-only', () => {
		assert.equal(localOnlyCoversId('launch-campaign', ['launch-campaign-site']), false);
		assert.equal(localOnlyCoversId('launch-campaign-site', ['launch-campaign-site']), true);
	});
});

describe('localOnly persist', () => {
	it('marks and clears ids without touching a folder', async () => {
		const root = await mkdtemp(path.join(tmpdir(), 'localhelm-local-only-'));
		const first = await markLocalOnly(root, ['launch-campaign', 'demo']);
		assert.deepEqual(first.ids, ['demo', 'launch-campaign']);
		assert.equal(localOnlyPath(root).replace(/\\/g, '/').endsWith('.localhelm/local-only.json'), true);
		const cleared = await clearLocalOnly(root, ['launch-campaign']);
		assert.deepEqual(cleared.ids, ['demo']);
		assert.deepEqual((await readLocalOnly(root)).ids, ['demo']);
		await rm(root, { recursive: true, force: true });
	});
});
