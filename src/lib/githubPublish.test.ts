import assert from 'node:assert/strict';
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, it } from 'node:test';
import {
	detectGithubPublish,
	githubRepoFromOrigin,
	githubWorkflowUrl,
	looksLikeProvenancePublishWorkflow,
} from './githubPublish.js';

const SAMPLE = `
name: Publish
on:
  workflow_dispatch:
permissions:
  id-token: write
jobs:
  publish:
    steps:
      - run: npm publish --provenance --access public
`;

describe('githubPublish', () => {
	it('reads owner/repo from https and SSH aliases', () => {
		assert.deepEqual(githubRepoFromOrigin('https://github.com/Catalyst-Forge-LLC/finetuna.git'), {
			owner: 'Catalyst-Forge-LLC',
			repo: 'finetuna',
		});
		assert.deepEqual(githubRepoFromOrigin('git@github-acmegeek:Catalyst-Forge-LLC/ollanet.git'), {
			owner: 'Catalyst-Forge-LLC',
			repo: 'ollanet',
		});
		assert.equal(githubRepoFromOrigin('https://example.com/x.git'), null);
	});

	it('builds the Actions workflow page on github.com', () => {
		assert.equal(
			githubWorkflowUrl('git@github.com:Catalyst-Forge-LLC/finetuna.git', 'publish.yml'),
			'https://github.com/Catalyst-Forge-LLC/finetuna/actions/workflows/publish.yml',
		);
	});

	it('requires workflow_dispatch plus provenance publish', () => {
		assert.equal(looksLikeProvenancePublishWorkflow(SAMPLE), true);
		assert.equal(looksLikeProvenancePublishWorkflow('on:\n  push:\n  run: npm publish'), false);
	});

	it('finds publish.yml in a checkout', async () => {
		const root = await mkdtemp(path.join(tmpdir(), 'localhelm-ghpub-'));
		await mkdir(path.join(root, '.github', 'workflows'), { recursive: true });
		await writeFile(path.join(root, '.github', 'workflows', 'publish.yml'), SAMPLE);
		const hit = detectGithubPublish(root, 'https://github.com/Catalyst-Forge-LLC/finetuna.git');
		assert.equal(hit?.file, 'publish.yml');
		assert.equal(hit?.url, 'https://github.com/Catalyst-Forge-LLC/finetuna/actions/workflows/publish.yml');
		assert.equal(detectGithubPublish(root, undefined), null);
	});
});
