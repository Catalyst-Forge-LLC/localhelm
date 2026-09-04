import assert from 'node:assert/strict';
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, it } from 'node:test';
import type { ScannedServer } from 'ollanet';
import {
	applyDirtCommit,
	cleanSuggestedMessage,
	discoverOllanetServer,
	fallbackCommitMessage,
	ollamaCommitMessage,
	parseStatusPorcelain,
	pickOllanetServer,
	planDirtCommit,
	requireCommitIds,
	secretCommitSkip,
	type CommitDraftApi,
} from './dirtCommit.js';
import { runGit } from './git.js';
import type { LoadedManifest } from './manifest.js';

function fakeServer(partial: Partial<ScannedServer> = {}): ScannedServer {
	return {
		hostname: 'desk',
		dnsName: 'desk.ts.net',
		ip: '100.64.0.2',
		port: 11434,
		os: 'linux',
		source: 'tailscale',
		self: false,
		endpoint: 'http://100.64.0.2:11434',
		models: [{ name: 'llama3.2:latest', tuned: false }],
		...partial,
	};
}

const localServer = fakeServer({
	hostname: 'localhost',
	dnsName: '',
	ip: '127.0.0.1',
	source: 'localhost',
	self: true,
	endpoint: 'http://127.0.0.1:11434',
});

async function withoutOllamaEnv<T>(fn: () => Promise<T>): Promise<T> {
	const keys = ['LOCALHELM_OLLAMA_URL', 'LOCALHELM_OLLAMA_MACHINE', 'LOCALHELM_OLLAMA_MODEL'] as const;
	const prev = Object.fromEntries(keys.map((key) => [key, process.env[key]]));
	for (const key of keys) delete process.env[key];
	try {
		return await fn();
	} finally {
		for (const key of keys) {
			if (prev[key] == null) delete process.env[key];
			else process.env[key] = prev[key];
		}
	}
}

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

	it('prefers a live local Ollama host over a network one', () => {
		const remote = fakeServer();
		assert.equal(pickOllanetServer([remote, localServer]), localServer);
		assert.equal(pickOllanetServer([remote]), remote);
	});

	it('asks ollanet for localhost first and skips LAN when a host is live', async () => {
		const seen: Array<{ lanScan?: boolean; save?: boolean }> = [];
		const picked = await discoverOllanetServer({
			scanNetwork: async (opts) => {
				seen.push(opts);
				return { servers: [localServer] };
			},
			lastScan: async () => ({ servers: [fakeServer()] }),
		});
		assert.ok(!('error' in picked));
		assert.equal(picked.endpoint, localServer.endpoint);
		assert.deepEqual(seen, [{ lanScan: false, save: false }]);
	});

	it('uses a last-scan network host before a LAN sweep', async () => {
		const remote = fakeServer();
		const seen: Array<{ lanScan?: boolean; save?: boolean }> = [];
		const picked = await discoverOllanetServer({
			scanNetwork: async (opts) => {
				seen.push(opts);
				if (opts.lanScan) return { servers: [remote] };
				return { servers: [] };
			},
			lastScan: async () => ({ servers: [localServer, remote] }),
		});
		assert.ok(!('error' in picked));
		assert.equal(picked.ip, remote.ip);
		assert.deepEqual(seen, [{ lanScan: false, save: false }]);
	});

	it('sweeps the LAN only when live and last-scan find nothing', async () => {
		const remote = fakeServer();
		const seen: Array<{ lanScan?: boolean; save?: boolean }> = [];
		const picked = await discoverOllanetServer({
			scanNetwork: async (opts) => {
				seen.push(opts);
				return opts.lanScan ? { servers: [remote] } : { servers: [] };
			},
			lastScan: async () => ({ servers: [localServer] }),
		});
		assert.ok(!('error' in picked));
		assert.equal(picked.ip, remote.ip);
		assert.deepEqual(seen, [
			{ lanScan: false, save: false },
			{ lanScan: true, save: false },
		]);
	});

	it('uses Ollama text from the host ollanet picked', async () => {
		await withoutOllamaEnv(async () => {
			const api: CommitDraftApi = {
				scanNetwork: async () => ({ servers: [localServer] }),
				lastScan: async () => null,
				ollamaChat: async () => ({ content: 'Fix lease bind on Windows.', thinking: '', chunk: {} }),
			};
			const drafted = await ollamaCommitMessage('prompt', api);
			assert.ok(!('error' in drafted));
			assert.equal(drafted.message, 'Fix lease bind on Windows.');
			assert.equal(drafted.model, 'llama3.2:latest');
			assert.equal(drafted.host, 'localhost');
		});
	});

	it('returns a plain error when ollanet finds no host', async () => {
		await withoutOllamaEnv(async () => {
			const drafted = await ollamaCommitMessage('prompt', {
				scanNetwork: async () => ({ servers: [] }),
				lastScan: async () => null,
			});
			assert.ok('error' in drafted);
			assert.match(drafted.error, /ollanet found no Ollama host/);
		});
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
