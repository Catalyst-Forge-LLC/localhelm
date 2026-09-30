import assert from 'node:assert/strict';
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, it } from 'node:test';
import type { ScannedServer } from 'ollanet';
import {
	applyDirtCommit,
	cleanSuggestedMessage,
	commitDraftDestination,
	discoverOllanetServer,
	fallbackCommitMessage,
	ollamaCommitMessage,
	parseStatusPorcelain,
	pickOllanetServer,
	commitDiffPreview,
	formatUntrackedPreview,
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

	it('prefers a live network Ollama host over this machine', () => {
		const remote = fakeServer();
		const selfTailscale = fakeServer({
			hostname: 'MYCROFTONE',
			dnsName: 'mycroftone.tail78ca25.ts.net',
			ip: '100.74.12.14',
			self: true,
			endpoint: 'http://100.74.12.14:11434',
		});
		assert.equal(pickOllanetServer([localServer, selfTailscale, remote]), remote);
		assert.equal(pickOllanetServer([remote, localServer]), remote);
		assert.equal(pickOllanetServer([localServer]), localServer);
	});

	it('uses a live local host and skips LAN when no remote is up', async () => {
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

	it('does not sweep the LAN unless explicitly requested', async () => {
		const seen: Array<{ lanScan?: boolean; save?: boolean }> = [];
		const picked = await discoverOllanetServer({
			scanNetwork: async (opts) => { seen.push(opts); return { servers: [] }; },
			lastScan: async () => null,
		});
		assert.ok('error' in picked);
		assert.deepEqual(seen, [{ lanScan: false, save: false }]);
	});

	it('sweeps the LAN only with explicit discovery opt-in', async () => {
		const remote = fakeServer();
		const seen: Array<{ lanScan?: boolean; save?: boolean }> = [];
		const picked = await discoverOllanetServer({
			scanNetwork: async (opts) => {
				seen.push(opts);
				return opts.lanScan ? { servers: [remote] } : { servers: [] };
			},
			lastScan: async () => ({ servers: [localServer] }),
		}, { lanScan: true });
		assert.ok(!('error' in picked));
		assert.equal(picked.ip, remote.ip);
		assert.deepEqual(seen, [
			{ lanScan: false, save: false },
			{ lanScan: true, save: false },
		]);
	});

	it('drafts locally without discovery or cached remote selection', async () => {
		await withoutOllamaEnv(async () => {
			let destination = '';
			const api: CommitDraftApi = {
				scanNetwork: async () => { throw new Error('discovery must not run'); },
				lastScan: async () => { throw new Error('cached remote must not be read'); },
				ollamaTags: async (base) => { assert.equal(base, 'http://127.0.0.1:11434'); return [{ name: 'llama3.2:latest' }]; },
				ollamaChat: async (opts) => { destination = opts.baseUrl; return { content: 'Fix lease bind on Windows.', thinking: '', chunk: {} }; },
			};
			const drafted = await ollamaCommitMessage('prompt', api);
			assert.ok(!('error' in drafted));
			assert.equal(drafted.message, 'Fix lease bind on Windows.');
			assert.equal(drafted.model, 'llama3.2:latest');
			assert.equal(drafted.host, '127.0.0.1:11434');
			assert.equal(destination, 'http://127.0.0.1:11434');
		});
	});

	it('retains explicit URL and machine destinations', async () => {
		await withoutOllamaEnv(async () => {
			process.env.LOCALHELM_OLLAMA_MODEL = 'chosen-model';
			const seen: string[] = [];
			const api: CommitDraftApi = {
				scanNetwork: async () => { throw new Error('must not discover'); },
				ollamaChat: async (opts) => { seen.push(opts.baseUrl); assert.equal(opts.model, 'chosen-model'); return { content: 'Chosen draft.', thinking: '', chunk: {} }; },
				resolveTarget: async () => ({ hostname: 'chosen', dnsName: '', ip: '192.0.2.10', port: 11434, source: 'config', isSelf: false }),
			};
			process.env.LOCALHELM_OLLAMA_URL = 'http://user:password@192.0.2.20:11434';
			assert.equal(commitDraftDestination(), '192.0.2.20:11434');
			assert.ok(!('error' in await ollamaCommitMessage('fixture prompt', api)));
			delete process.env.LOCALHELM_OLLAMA_URL;
			process.env.LOCALHELM_OLLAMA_MACHINE = 'chosen';
			assert.equal(commitDraftDestination(), 'chosen');
			assert.ok(!('error' in await ollamaCommitMessage('fixture prompt', api)));
			assert.deepEqual(seen, ['http://user:password@192.0.2.20:11434', 'http://192.0.2.10:11434']);
		});
	});

	it('returns an actionable error when the selected local host is unavailable', async () => {
		await withoutOllamaEnv(async () => {
			const drafted = await ollamaCommitMessage('prompt', {
				ollamaTags: async () => { throw new Error('ECONNREFUSED'); },
			});
			assert.ok('error' in drafted);
			assert.match(drafted.error, /selected Ollama host/);
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
		await withoutOllamaEnv(async () => {
			const unavailable = await planDirtCommit(loaded, ['widget'], {
				suggest: true,
				draft: { ollamaTags: async () => { throw new Error('ECONNREFUSED'); }, ollamaChat: async () => { throw new Error('no prompt may be sent'); } },
			});
			assert.equal(unavailable.rows[0]?.suggestSource, 'fallback');
			assert.equal(unavailable.rows[0]?.message, plan.rows[0]?.message);
			assert.match(unavailable.rows[0]?.suggestNote ?? '', /selected Ollama host/);
		});
		assert.equal(plan.rows[0]?.action, 'commit');
		assert.equal(plan.rows[0]?.files.some((file) => file.path === 'src.ts'), true);
		assert.match(plan.rows[0]?.diffs?.['src.ts'] ?? '', /export const n = 1/);
		assert.match(plan.rows[0]?.diffs?.['src.ts'] ?? '', /^\+export const n = 1/m);
		const applied = applyDirtCommit(loaded, plan.rows[0]!, 'Add src.ts.');
		assert.equal(applied.action, 'commit');
		assert.equal(applied.reason, undefined);
		const log = runGit(pkgDir, ['log', '-1', '--pretty=%s']);
		assert.equal(log.stdout.trim(), 'Add src.ts.');
		assert.equal(runGit(pkgDir, ['status', '--porcelain']).stdout.trim(), '');
	});

	it('previews a tracked edit and leaves secrets out of the diff', async () => {
		const root = await mkdtemp(path.join(tmpdir(), 'localhelm-commit-diff-'));
		await gitRepo(root);
		await writeFile(path.join(root, 'README.md'), 'hello\nworld\n');
		await writeFile(path.join(root, '.env'), 'TOKEN=secret\n');
		const diff = await commitDiffPreview(root, [
			{ code: ' M', path: 'README.md' },
			{ code: '??', path: '.env', skip: 'looks like a secret' },
		]);
		assert.match(diff['README.md'] ?? '', /diff --git a\/README.md/);
		assert.match(diff['README.md'] ?? '', /\+world/);
		assert.match(diff['.env'] ?? '', /skipped/);
		assert.doesNotMatch(diff['README.md'] ?? '', /TOKEN=secret/);
		assert.doesNotMatch(diff['.env'] ?? '', /TOKEN=secret/);
	});

	it('formats an untracked file as additions', () => {
		assert.match(formatUntrackedPreview('notes.md', 'one\ntwo\n'), /new file mode 100644/);
		assert.match(formatUntrackedPreview('notes.md', 'one\ntwo\n'), /\+one\n\+two/);
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
