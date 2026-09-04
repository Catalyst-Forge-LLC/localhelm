import assert from 'node:assert/strict';
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, it } from 'node:test';
import {
	applyDirtCommit,
	cleanSuggestedMessage,
	fallbackCommitMessage,
	ollamaCommitMessage,
	parseStatusPorcelain,
	planDirtCommit,
	requireCommitIds,
	secretCommitSkip,
} from './dirtCommit.js';
import { runGit } from './git.js';
import type { LoadedManifest } from './manifest.js';

async function gitRepo(dir: string): Promise<void> {
	assert.equal(runGit(dir, ['init']).ok, true);
	assert.equal(runGit(dir, ['config', 'user.email', 'localhelm@test']).ok, true);
	assert.equal(runGit(dir, ['config', 'user.name', 'LocalHelm Test']).ok, true);
	await writeFile(path.join(dir, 'README.md'), 'hello\n');
	assert.equal(runGit(dir, ['add', 'README.md']).ok, true);
	assert.equal(runGit(dir, ['commit', '-m', 'init']).ok, true);
}

describe('dirtCommit helpers', () => {
	it('requires named ids on apply', () => {
		assert.throws(() => requireCommitIds([]), /name the project id/);
		assert.deepEqual(requireCommitIds([' coldeye ', 'localhelm']), ['coldeye', 'localhelm']);
	});

	it('parses porcelain and skips secret-looking paths', () => {
		const files = parseStatusPorcelain([' M src/foo.ts', '?? .env', 'A  notes.md'].join('\n'));
		assert.equal(files[0]?.path, 'src/foo.ts');
		assert.equal(files[1]?.path, '.env');
		assert.equal(files[1]?.skip, 'looks like a secret');
		assert.equal(secretCommitSkip('.npmrc'), 'may hold an npm token');
		assert.equal(fallbackCommitMessage(files), 'Update foo.ts and notes.md.');
	});

	it('strips fences from an Ollama draft', () => {
		assert.equal(cleanSuggestedMessage('```\nFix the bind.\n```'), 'Fix the bind.');
		assert.equal(cleanSuggestedMessage('Here is a commit message:\n\nFix the bind.'), 'Fix the bind.');
	});

	it('uses Ollama text when generate succeeds', async () => {
		const drafted = await ollamaCommitMessage('prompt', async (url) => {
			if (String(url).endsWith('/api/tags')) {
				return new Response(JSON.stringify({ models: [{ name: 'llama3.2:latest' }] }));
			}
			return new Response(JSON.stringify({ response: 'Fix lease bind on Windows.' }));
		});
		assert.ok(!('error' in drafted));
		assert.equal(drafted.message, 'Fix lease bind on Windows.');
		assert.equal(drafted.model, 'llama3.2:latest');
	});

	it('returns a plain error when Ollama is down', async () => {
		const drafted = await ollamaCommitMessage('prompt', async () => {
			throw new Error('fetch failed');
		});
		assert.ok('error' in drafted);
		assert.match(drafted.error, /Ollama is not running/);
	});
});

describe('dirtCommit plan/apply', () => {
	it('plans dirty files and commits the named message', async () => {
		const root = await mkdtemp(path.join(tmpdir(), 'localhelm-commit-'));
		const pkgDir = path.join(root, 'widget');
		await mkdir(pkgDir);
		await gitRepo(pkgDir);
		await writeFile(path.join(pkgDir, 'src.ts'), 'export const n = 1;\n');
		const loaded: LoadedManifest = {
			manifestPath: path.join(root, 'localhelm.fleet.json'),
			workspaceRoot: root,
			manifest: { workspaceRoot: '.', projects: [{ id: 'widget', path: 'widget' }] },
		};
		const plan = await planDirtCommit(loaded, ['widget'], { suggest: false });
		assert.equal(plan.rows[0]?.action, 'commit');
		assert.equal(plan.rows[0]?.files.some((file) => file.path === 'src.ts'), true);
		const applied = applyDirtCommit(loaded, plan.rows[0]!, 'Add src.ts.');
		assert.equal(applied.action, 'commit');
		assert.equal(applied.reason, undefined);
		const log = runGit(pkgDir, ['log', '-1', '--pretty=%s']);
		assert.equal(log.stdout.trim(), 'Add src.ts.');
		assert.equal(runGit(pkgDir, ['status', '--porcelain']).stdout.trim(), '');
	});

	it('skips a clean tree', async () => {
		const root = await mkdtemp(path.join(tmpdir(), 'localhelm-commit-clean-'));
		const pkgDir = path.join(root, 'widget');
		await mkdir(pkgDir);
		await gitRepo(pkgDir);
		const loaded: LoadedManifest = {
			manifestPath: path.join(root, 'localhelm.fleet.json'),
			workspaceRoot: root,
			manifest: { workspaceRoot: '.', projects: [{ id: 'widget', path: 'widget' }] },
		};
		const plan = await planDirtCommit(loaded, ['widget'], { suggest: false });
		assert.equal(plan.rows[0]?.action, 'skip');
		assert.equal(plan.rows[0]?.reason, 'clean');
	});
});
