import assert from 'node:assert/strict';
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, it } from 'node:test';
import { listFactsFiles, rewriteFactsVersion } from './factsVersion.js';

describe('factsVersion', () => {
	it('rewrites quoted frontmatter and the Version table', () => {
		const raw = [
			'---',
			'skill_facts_version: "0.1.0"',
			'version: "0.1.11"',
			'---',
			'| **Version** | 0.1.11 |',
			'',
		].join('\n');
		const next = rewriteFactsVersion(raw, '0.1.11', '0.1.12');
		assert.ok(next);
		assert.match(next, /skill_facts_version: "0\.1\.0"/);
		assert.match(next, /version: "0\.1\.12"/);
		assert.match(next, /\| \*\*Version\*\* \| 0\.1\.12 \|/);
		assert.doesNotMatch(next, /0\.1\.11/);
	});

	it('lists APP/TOOL/SKILL facts and skips node_modules', async () => {
		const root = await mkdtemp(path.join(tmpdir(), 'localhelm-facts-'));
		await mkdir(path.join(root, 'skills', 'play'), { recursive: true });
		await mkdir(path.join(root, 'node_modules', 'other'), { recursive: true });
		await writeFile(path.join(root, 'APP_FACTS.md'), '---\nversion: "1.0.0"\n---\n');
		await writeFile(path.join(root, 'skills', 'play', 'SKILL_FACTS.md'), '---\nversion: "1.0.0"\n---\n');
		await writeFile(path.join(root, 'node_modules', 'other', 'SKILL_FACTS.md'), '---\nversion: "9.9.9"\n---\n');
		const files = await listFactsFiles(root);
		assert.equal(files.length, 2);
		assert.ok(files.some((file) => file.endsWith('APP_FACTS.md')));
		assert.ok(files.some((file) => file.includes('SKILL_FACTS.md')));
		assert.ok(!files.some((file) => file.includes('node_modules')));
	});
});
