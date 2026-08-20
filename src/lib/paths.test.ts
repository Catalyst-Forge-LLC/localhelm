import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { isFsRoot, parentDir, skipDirName, slugId, toPosix } from './paths.js';

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

	it('walk-up stops at a Windows drive root', () => {
		assert.equal(toPosix('Z:'), 'Z:/');
		assert.equal(toPosix('Z:/'), 'Z:/');
		let dir = 'Z:/workspace/localhelm';
		const seen = new Set<string>();
		for (let i = 0; i < 20; i += 1) {
			const next = parentDir(dir);
			if (next === dir) {
				assert.equal(isFsRoot(next), true);
				return;
			}
			assert.equal(seen.has(next), false, `cycle at ${next}`);
			seen.add(next);
			dir = next;
		}
		assert.fail('did not stop at drive root');
	});
});
