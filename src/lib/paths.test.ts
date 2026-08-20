import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { skipDirName, slugId, toPosix } from './paths.js';

describe('paths', () => {
	it('normalizes slashes', () => {
		assert.equal(toPosix('Z:\\workspace\\foo'), 'Z:/workspace/foo');
	});

	it('slugs folder names', () => {
		assert.equal(slugId('FilePress'), 'filepress');
		assert.equal(slugId('ember-dossier'), 'ember-dossier');
	});

	it('skips noise dirs', () => {
		assert.equal(skipDirName('node_modules'), true);
		assert.equal(skipDirName('__ARCHIVE'), true);
		assert.equal(skipDirName('.git'), true);
		assert.equal(skipDirName('filepress'), false);
	});
});
