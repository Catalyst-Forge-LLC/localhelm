import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdir, mkdtemp, readFile, realpath, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, it } from 'node:test';
import { applyGitTrust, planGitTrust } from './gitTrust.js';
import { gitStatusBadge, isGitOwnershipError } from './gitTrustDisplay.js';
import type { LoadedManifest } from './manifest.js';
import { toPosix } from './paths.js';
import type { GitCell } from './types.js';

const ownershipError = "fatal: detected dubious ownership in repository at '/repo'\nTo add an exception for this directory, call:\n git config --global --add safe.directory /repo";
const git: GitCell = { repo: true, dirty: false, staged: 0, unstaged: 0, untracked: 0, ahead: null, behind: null };

async function fixture() {
	const root = await mkdtemp(path.join(tmpdir(), 'localhelm-trust-'));
	const dir = path.join(root, 'repo with spaces');
	await mkdir(path.join(dir, '.git'), { recursive: true });
	const loaded: LoadedManifest = {
		workspaceRoot: root, manifestPath: path.join(root, 'localhelm.fleet.json'),
		manifest: { workspaceRoot: '.', projects: [{ id: 'widget', path: 'repo with spaces' }] },
	};
	return { root, dir, loaded, directory: toPosix(await realpath(dir)) };
}

describe('Git ownership recovery', () => {
	it('distinguishes ownership refusal from generic errors and successful status', () => {
		assert.equal(isGitOwnershipError(ownershipError), true);
		assert.equal(isGitOwnershipError('fatal: permission denied'), false);
		assert.equal(isGitOwnershipError('remote: detected dubious ownership'), false);
		assert.equal(isGitOwnershipError(undefined), false);
		assert.equal(gitStatusBadge(ownershipError)?.text, 'Git trust required');
		assert.equal(gitStatusBadge('fatal: permission denied')?.text, 'Git status unavailable');
		assert.equal(gitStatusBadge(undefined), null);
	});

	it('plans only the enrolled canonical checkout, without writing or using stderr paths', async () => {
		const { loaded, directory } = await fixture();
		const inspected: string[] = [];
		const io = {
			read: async (dir: string) => { inspected.push(dir); return { ...git, error: ownershipError }; },
			run: async () => { throw new Error('Plan must not write'); },
		};
		assert.deepEqual(await planGitTrust(loaded, 'widget', io), { id: 'widget', directory, action: 'trust' });
		assert.deepEqual(inspected, [directory]);
		assert.equal((await planGitTrust(loaded, 'unknown', io)).action, 'skip');
		assert.deepEqual(inspected, [directory]);
	});

	it('finds the checkout root for an enrolled nested package', async () => {
		const { loaded, dir, directory } = await fixture();
		await mkdir(path.join(dir, 'packages', 'tool'), { recursive: true });
		loaded.manifest.projects[0]!.path = 'repo with spaces/packages/tool';
		const plan = await planGitTrust(loaded, 'widget', {
			read: async () => ({ ...git, error: ownershipError }),
			run: async () => { throw new Error('Plan must not write'); },
		});
		assert.equal(plan.directory, directory);
	});

	it('does not write when Git now reads the directory or reports a different error', async () => {
		const { loaded, directory } = await fixture();
		for (const error of [undefined, 'fatal: permission denied']) {
			const result = await applyGitTrust(loaded, 'widget', directory, {
				read: async () => ({ ...git, error }), run: async () => { throw new Error('No trust write allowed'); },
			});
			assert.equal(result.writes, false);
			assert.equal(result.action, 'skip');
		}
	});

	it('refuses a changed confirmation target and a no-longer-enrolled project', async () => {
		const { loaded, directory } = await fixture();
		const io = { read: async () => ({ ...git, error: ownershipError }), run: async () => { throw new Error('No trust write allowed'); } };
		await assert.rejects(applyGitTrust(loaded, 'widget', directory + '/other', io), /directory changed/);
		await assert.rejects(applyGitTrust(loaded, 'missing', directory, io), /directory changed/);
	});

	it('does not report a failed config write as success', async () => {
		const { loaded, directory } = await fixture();
		await assert.rejects(applyGitTrust(loaded, 'widget', directory, {
			read: async () => ({ ...git, error: ownershipError }),
			run: async () => ({ ok: false, stdout: '', stderr: 'cannot lock global config' }),
		}), /cannot lock global config/);
	});

	it('records remaining Git errors after a successful trust write', async () => {
		const { loaded, directory } = await fixture();
		let reads = 0;
		const result = await applyGitTrust(loaded, 'widget', directory, {
			read: async () => ({ ...git, error: reads++ === 0 ? ownershipError : 'fatal: invalid HEAD' }),
			run: async () => ({ ok: true, stdout: '', stderr: '' }),
		});
		assert.equal(result.writes, true);
		assert.equal(result.remainingError, 'fatal: invalid HEAD');
	});

	it('writes exactly one scoped entry with real Git to an isolated global config', async () => {
		const { root, loaded, directory } = await fixture();
		const config = path.join(root, 'test-global.gitconfig');
		await writeFile(config, '[user]\n\tname = Preserved\n');
		const env = { ...process.env, GIT_CONFIG_GLOBAL: config, GIT_CONFIG_NOSYSTEM: '1' };
		const calls: string[][] = [];
		let reads = 0;
		const io = {
			read: async () => ({ ...git, ...(reads++ === 0 ? { error: ownershipError } : {}) }),
			run: async (dir: string, args: string[]) => {
				assert.equal(dir, directory);
				calls.push(args);
				const result = spawnSync('git', ['-C', dir, ...args], { env, encoding: 'utf8', windowsHide: true });
				return { ok: result.status === 0, stdout: result.stdout ?? '', stderr: result.stderr ?? '' };
			},
		};
		assert.equal((await applyGitTrust(loaded, 'widget', directory, io)).writes, true);
		assert.deepEqual(calls, [['config', '--global', '--add', 'safe.directory', directory]]);
		const check = spawnSync('git', ['config', '--global', '--get-all', 'safe.directory'], { env, encoding: 'utf8', windowsHide: true });
		assert.equal(check.status, 0);
		assert.deepEqual(check.stdout.trim().split(/\r?\n/), [directory]);
		assert.match(await readFile(config, 'utf8'), /name = Preserved/);
		assert.equal((await applyGitTrust(loaded, 'widget', directory, io)).writes, false);
		assert.equal(calls.length, 1);
	});
});
