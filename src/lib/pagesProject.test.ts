import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { it } from 'node:test';
import { applyPagesProject, pagesScriptTarget, planPagesProject, shipPagesPreflight, type PagesRuntime } from './pagesProject.js';
import { runWithDemo } from './demoMode.js';
import { isMissingPagesProject } from './pagesProjectTypes.js';
import { plainPluginError } from './plainError.js';
import { jobAcknowledgement } from './jobJournal.js';
import type { LoadedManifest } from './manifest.js';

const accountId = 'a'.repeat(32);
const secondId = 'b'.repeat(32);
const ship = 'pnpm build && wrangler pages deploy build --project-name widget --branch main';
async function fixture(options: { root?: boolean; delegate?: string; direct?: boolean } = {}) {
	const workspaceRoot = await mkdtemp(path.join(tmpdir(), 'localhelm-pages-'));
	const root = path.join(workspaceRoot, 'widget');
	const directory = options.root ? root : path.join(root, 'site');
	await mkdir(path.join(directory, 'node_modules', 'wrangler', 'wrangler-dist'), { recursive: true });
	const rootPkg = path.join(root, 'package.json');
	const sitePkg = path.join(directory, 'package.json');
	await writeFile(rootPkg, JSON.stringify({ name: 'widget', scripts: options.root ? { ship } : { ship: options.delegate ?? 'pnpm --dir site ship' } }));
	if (!options.root) await writeFile(sitePkg, JSON.stringify({ scripts: { ship } }));
	await writeFile(path.join(directory, 'node_modules', 'wrangler', 'package.json'), JSON.stringify({ name: 'wrangler', version: '4.151.1' }));
	await writeFile(path.join(directory, 'node_modules', 'wrangler', 'wrangler-dist', 'cli.js'), options.direct === false ? '// older Wrangler' : '// maybeDelegatePagesToWorkers Create a Cloudflare Pages project directly, bypassing the automatic delegation');
	const loaded: LoadedManifest = { manifestPath: path.join(workspaceRoot, 'localhelm.fleet.json'), workspaceRoot, manifest: { workspaceRoot: '.', projects: [{ id: 'widget', path: 'widget' }] } };
	const calls: { directory: string; args: string[]; accountId?: string }[] = [];
	const state = { accounts: [{ id: accountId, name: 'Example account' }], permissions: ['pages:write'], exists: false, createOk: true, listOk: true };
	const io: PagesRuntime = {
		env: {},
		run: async (_entry, cwd, args, id) => {
			calls.push({ directory: cwd, args, accountId: id });
			if (args[0] === 'whoami') return { ok: true, stdout: JSON.stringify({ loggedIn: true, accounts: state.accounts, tokenPermissions: state.permissions }), stderr: '' };
			if (args.includes('list')) return { ok: state.listOk, stdout: JSON.stringify(state.exists ? [{ 'Project Name': 'widget' }] : []), stderr: state.listOk ? '' : '✘ [ERROR] Account access denied' };
			if (args.includes('create')) { if (state.createOk) state.exists = true; return { ok: state.createOk, stdout: '', stderr: state.createOk ? '' : '✘ [ERROR] Unable to create project' }; }
			throw new Error('Unexpected command: ' + args.join(' '));
		},
	};
	return { loaded, root, directory, rootPkg, sitePkg, io, state, calls };
}

it('extracts literal project/branch flags, never guesses from folder names or Git', () => {
	assert.deepEqual(pagesScriptTarget(ship), { projectName: 'widget', productionBranch: 'main' });
	assert.deepEqual(pagesScriptTarget('wrangler pages deploy "build output" --branch=release/v1 --project-name="widget"'), { projectName: 'widget', productionBranch: 'release/v1' });
	for (const unsafe of [
		'wrangler pages deploy build --project-name widget',
		'wrangler pages deploy build --project-name $NAME --branch main',
		'wrangler pages deploy build --project-name widget --branch main --config other.toml',
		'wrangler pages deploy build --project-name widget --project-name other --branch main',
		'set CLOUDFLARE_ACCOUNT_ID=bad && ' + ship,
		'cd elsewhere && ' + ship,
		ship + ' ; echo bad', ship + ' --branch ../other',
		'wrangler deploy build --project-name widget --branch main',
	]) assert.equal(pagesScriptTarget(unsafe), null, unsafe);
});

it('plans nested Pages creation read-only with the actual account and branch', async () => {
	const f = await fixture();
	const plan = await planPagesProject(f.loaded, 'widget', f.io);
	assert.equal(plan.action, 'create');
	assert.equal(plan.target?.projectName, 'widget');
	assert.equal(plan.target?.productionBranch, 'main');
	assert.equal(plan.target?.accountName, 'Example account');
	assert.equal(plan.target?.accountId, accountId);
	assert.match(plan.target?.directory ?? '', /widget\/site$/);
	assert.equal(f.calls.some((c) => c.args.includes('create')), false);
	assert.equal(f.calls[1]?.accountId, accountId);
});
it('supports root scripts and the conventional run delegation', async () => {
	for (const options of [{ root: true }, { delegate: 'pnpm --dir site run ship' }, { delegate: 'pnpm --dir "site" ship' }]) {
		const f = await fixture(options);
		assert.equal((await planPagesProject(f.loaded, 'widget', f.io)).action, 'create');
	}
});
it('creates only the exact confirmed Pages target, then verifies; never deploys', async () => {
	const f = await fixture();
	const plan = await planPagesProject(f.loaded, 'widget', f.io);
	const result = await applyPagesProject(f.loaded, 'widget', plan.target!.revision, f.io);
	assert.equal(result.ok, true);
	assert.equal(result.writes, true);
	const create = f.calls.find((c) => c.args.includes('create'))!;
	assert.deepEqual(create.args, ['pages', 'project', 'create', 'widget', '--production-branch', 'main', '--force']);
	assert.equal(create.accountId, accountId);
	assert.equal(create.directory, plan.target?.directory);
	assert.equal(f.calls.some((c) => c.args.includes('deploy')), false);
	assert.equal(jobAcknowledgement(result, 'widget').state, 'succeeded');
});
it('does not add the Pages delegation opt-out to older Wrangler', async () => {
	const f = await fixture({ direct: false });
	const plan = await planPagesProject(f.loaded, 'widget', f.io);
	await applyPagesProject(f.loaded, 'widget', plan.target!.revision, f.io);
	assert.equal(f.calls.find((c) => c.args.includes('create'))?.args.includes('--force'), false);
});
it('rejects an absent/stale confirmation without a create', async () => {
	const f = await fixture();
	await assert.rejects(applyPagesProject(f.loaded, 'widget', '', f.io), /new confirmation/);
	const plan = await planPagesProject(f.loaded, 'widget', f.io);
	await writeFile(f.sitePkg, JSON.stringify({ scripts: { ship: ship.replace('--branch main', '--branch production') } }));
	await assert.rejects(applyPagesProject(f.loaded, 'widget', plan.target!.revision, f.io), /new confirmation/);
	assert.equal(f.calls.some((c) => c.args.includes('create')), false);
});
it('refuses a changed account after confirmation', async () => {
	const f = await fixture();
	const plan = await planPagesProject(f.loaded, 'widget', f.io);
	f.state.accounts = [{ id: secondId, name: 'Another account' }];
	await assert.rejects(applyPagesProject(f.loaded, 'widget', plan.target!.revision, f.io), /new confirmation/);
	assert.equal(f.calls.some((c) => c.args.includes('create')), false);
});
it('uses the selected account and blocks ambiguous/missing account selection', async () => {
	const f = await fixture();
	f.state.accounts.push({ id: secondId, name: 'Second account' });
	assert.match((await planPagesProject(f.loaded, 'widget', f.io)).reason, /ambiguous/);
	f.io.env.CLOUDFLARE_ACCOUNT_ID = secondId;
	assert.equal((await planPagesProject(f.loaded, 'widget', f.io)).target?.accountId, secondId);
	f.io.env.CLOUDFLARE_ACCOUNT_ID = 'c'.repeat(32);
	assert.equal((await planPagesProject(f.loaded, 'widget', f.io)).action, 'blocked');
});
it('honors the existing Pages account cache instead of silently changing accounts', async () => {
	const f = await fixture();
	f.state.accounts.push({ id: secondId, name: 'Second account' });
	await mkdir(path.join(f.directory, 'node_modules', '.cache', 'wrangler'), { recursive: true });
	await writeFile(path.join(f.directory, 'node_modules', '.cache', 'wrangler', 'pages.json'), JSON.stringify({ account_id: secondId }));
	assert.equal((await planPagesProject(f.loaded, 'widget', f.io)).target?.accountId, secondId);
});
it('handles already-created projects and a create race without another write', async () => {
	const f = await fixture();
	const plan = await planPagesProject(f.loaded, 'widget', f.io);
	f.state.exists = true;
	const result = await applyPagesProject(f.loaded, 'widget', plan.target!.revision, f.io);
	assert.equal(result.action, 'exists');
	assert.equal(result.ok, true);
	assert.equal(result.writes, false);
	assert.equal(f.calls.some((c) => c.args.includes('create')), false);
});
it('returns create failures without retrying or deploying', async () => {
	const f = await fixture();
	const plan = await planPagesProject(f.loaded, 'widget', f.io);
	f.state.createOk = false;
	const result = await applyPagesProject(f.loaded, 'widget', plan.target!.revision, f.io);
	assert.equal(result.ok, false);
	assert.match(result.reason, /Unable to create project/);
	assert.equal(f.calls.filter((c) => c.args.includes('create')).length, 1);
});
it('blocks account/auth reads and does not confuse permission errors with absence', async () => {
	const f = await fixture();
	f.state.listOk = false;
	assert.equal((await planPagesProject(f.loaded, 'widget', f.io)).action, 'blocked');
	f.state.listOk = true; f.state.permissions = ['workers:write'];
	assert.match((await planPagesProject(f.loaded, 'widget', f.io)).reason, /Pages write permission/);
	assert.equal(f.calls.some((c) => c.args.includes('create')), false);
});
it('unrecognized scripts, unenrolled ids and config overrides never offer automatic creation', async () => {
	const f = await fixture();
	assert.equal((await planPagesProject(f.loaded, 'unknown', f.io)).action, 'blocked');
	await writeFile(f.sitePkg, JSON.stringify({ scripts: { ship: 'node custom-deploy.js' } }));
	assert.equal(await shipPagesPreflight(f.loaded, 'widget', f.io), undefined);
	assert.equal(f.calls.length, 0);
	await writeFile(f.sitePkg, JSON.stringify({ scripts: { ship } }));
	await writeFile(path.join(f.directory, 'wrangler.toml'), 'account_id = "elsewhere"');
	assert.equal((await planPagesProject(f.loaded, 'widget', f.io)).action, 'blocked');
	assert.equal(f.calls.length, 0);
});
it('rejects a linked site outside the enrolled checkout', async () => {
	const f = await fixture({ root: true });
	const other = await mkdtemp(path.join(tmpdir(), 'localhelm-other-site-'));
	await writeFile(path.join(other, 'package.json'), JSON.stringify({ scripts: { ship } }));
	await symlink(other, path.join(f.root, 'site'), process.platform === 'win32' ? 'junction' : 'dir');
	await writeFile(f.rootPkg, JSON.stringify({ scripts: { ship: 'pnpm --dir site ship' } }));
	assert.match((await planPagesProject(f.loaded, 'widget', f.io)).reason, /outside/);
	assert.equal(f.calls.length, 0);
});
it('Demo cannot create a Pages project', async () => {
	const f = await fixture();
	await assert.rejects(runWithDemo(true, () => applyPagesProject(f.loaded, 'widget', 'unused', f.io)), /Demo board/);
	assert.equal(f.calls.length, 0);
});
it('reports the actual Wrangler error before benign FilePress output', () => {
	const error = '\u001b[31m✘ [ERROR]\u001b[0m The Pages project "widget" does not exist.';
	const message = plainPluginError('filepress: wrote default _headers\n' + error + '\nELIFECYCLE Command failed with exit code 1.');
	assert.equal(message, '✘ [ERROR] The Pages project "widget" does not exist.');
	assert.equal(isMissingPagesProject(message), true);
	assert.equal(isMissingPagesProject('✘ [ERROR] Authentication error'), false);
});
