import assert from 'node:assert/strict';
import { it } from 'node:test';
import { parseRemoteFetchUrls } from './git.js';
it('decodes Git config quoting for local Windows remotes without changing URL targets', () => {
	assert.equal(parseRemoteFetchUrls('[remote "origin"]\nurl = C:\\\\workspace\\\\origin.git\n').origin, 'C:\\workspace\\origin.git');
	assert.equal(parseRemoteFetchUrls('[remote "origin"]\nurl = "C:\\\\some folder\\\\origin.git"\n').origin, 'C:\\some folder\\origin.git');
	assert.equal(parseRemoteFetchUrls('[remote "origin"]\nurl = git@github.com:example/repo.git\n').origin, 'git@github.com:example/repo.git');
});
