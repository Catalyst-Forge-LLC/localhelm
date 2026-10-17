import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFile, realpath, stat } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
import { assertDemoAllowsRepoWrite } from './demoMode.js';
import type { LoadedManifest } from './manifest.js';
import { joinRoot, toPosix } from './paths.js';
import { pathExists } from './pkg.js';
import { plainPluginError } from './plainError.js';
import { planScriptShip, shipEnv } from './scriptShip.js';
import type { PagesProjectPlan, PagesProjectResult, PagesProjectTarget } from './pagesProjectTypes.js';

type CommandResult = { ok: boolean; stdout: string; stderr: string };
export type PagesRuntime = {
	env: NodeJS.ProcessEnv;
	run(entry: string, directory: string, args: string[], accountId?: string): Promise<CommandResult>;
};
export const pagesRuntime: PagesRuntime = {
	env: process.env,
	run(entry, directory, args, accountId) {
		return new Promise((resolve) => {
			execFile(process.execPath, [entry, ...args], {
				cwd: directory, windowsHide: true, timeout: 120_000, maxBuffer: 4 * 1024 * 1024,
				env: { ...shipEnv(), CI: 'true', NO_COLOR: '1', WRANGLER_SEND_METRICS: 'false',
					...(accountId ? { CLOUDFLARE_ACCOUNT_ID: accountId } : {}) },
			}, (error, stdout, stderr) => resolve({ ok: !error, stdout, stderr: stderr || error?.message || '' }));
		});
	},
};

type LocalTarget = { directory: string; projectName: string; productionBranch: string; source: string; entry: string; version: string; directPages: boolean };
const projectPattern = /^[a-z0-9](?:[a-z0-9-]{0,56}[a-z0-9])?$/;
const branchPattern = /^[A-Za-z0-9][A-Za-z0-9_./-]{0,127}$/;

/** Recognize literal arguments only. Shell variables, redirects, custom wrappers and config overrides need manual setup. */
export function pagesScriptTarget(script: string): { projectName: string; productionBranch: string } | null {
	const segments = script.trim().split(/\s*&&\s*/);
	if (segments.slice(0, -1).some((s) => !/^(?:pnpm (?:run )?[\w:-]+|npm run [\w:-]+)$/.test(s))) return null;
	const command = segments.at(-1) ?? '';
	const match = /^(?:(?:pnpm exec|npx --no-install) )?wrangler pages (?:deploy|publish)\s+(.+)$/.exec(command);
	if (!match || /[\r\n`$%&|;<>]/.test(match[1]!)) return null;
	const tokens = match[1]!.match(/"[^"]*"|'[^']*'|[^\s]+/g)?.map((s) => s.replace(/^(['"])(.*)\1$/, '$2')) ?? [];
	// One literal asset directory followed by known flags. Do not infer project/branch from folder or Git.
	if (!tokens[0] || tokens[0].startsWith('-')) return null;
	const values: Record<string, string> = {};
	for (let i = 1; i < tokens.length; i++) {
		const token = tokens[i]!;
		const equal = token.indexOf('=');
		const key = equal < 0 ? token : token.slice(0, equal);
		const value = (equal < 0 ? tokens[++i] : token.slice(equal + 1))?.replace(/^(['"])(.*)\1$/, '$2');
		if (!['--project-name', '--branch', '--commit-dirty'].includes(key) || !value || key in values) return null;
		values[key] = value;
	}
	const projectName = values['--project-name'] ?? '';
	const productionBranch = values['--branch'] ?? '';
	if (!projectPattern.test(projectName) || !branchPattern.test(productionBranch) || productionBranch.includes('..')) return null;
	return { projectName, productionBranch };
}

async function localTarget(loaded: LoadedManifest, id: string): Promise<LocalTarget | null> {
	const row = (await planScriptShip(loaded, [id]))[0];
	if (row?.action !== 'ship' || !row.cwd) return null;
	const project = loaded.manifest.projects.find((p) => p.id === id)!;
	const root = await realpath(joinRoot(loaded.workspaceRoot, project.path));
	let directory = await realpath(row.cwd);
	let source = await readFile(path.join(directory, 'package.json'), 'utf8');
	let script = JSON.parse(source).scripts?.ship;
	// The conventional root-to-site delegation is resolved, never executed during planning.
	if (typeof script === 'string' && /^pnpm --dir ["']?\.?\/?site["']? (?:run )?ship$/.test(script.trim())) {
		directory = await realpath(path.join(directory, 'site'));
		const nested = await readFile(path.join(directory, 'package.json'), 'utf8');
		source += '\n' + nested;
		script = JSON.parse(nested).scripts?.ship;
	}
	const relative = path.relative(root, directory);
	if (relative === '..' || relative.startsWith('..' + path.sep) || path.isAbsolute(relative)) throw new Error('The site directory resolves outside the enrolled checkout.');
	if (typeof script !== 'string') return null;
	const target = pagesScriptTarget(script);
	if (!target) return null;
	// Config files may change accounts/profiles or environment selection. Leave these existing Ship paths intact.
	for (let current = directory; ; current = path.dirname(current)) {
		for (const name of ['wrangler.toml', 'wrangler.json', 'wrangler.jsonc', '.env', '.env.local']) {
			if (await pathExists(path.join(current, name))) throw new Error('This site uses a Wrangler or environment file. Create its Pages project in Cloudflare, then retry Ship.');
		}
		if (path.dirname(current) === current) break;
	}
	const require = createRequire(path.join(directory, 'package.json'));
	let manifest: string;
	try { manifest = require.resolve('wrangler/package.json'); }
	catch { throw new Error('Install this site’s local Wrangler dependency before setting up Pages.'); }
	const pkg = JSON.parse(await readFile(manifest, 'utf8'));
	const entry = await realpath(path.resolve(path.dirname(manifest), 'wrangler-dist/cli.js'));
	const info = await stat(entry);
	// New Wrangler can delegate Pages creation to Workers in agent sessions. Only its explicit Pages opt-out is allowed here.
	const code = await readFile(entry, 'utf8');
	const directPages = code.includes('Create a Cloudflare Pages project directly, bypassing the automatic delegation');
	if (code.includes('maybeDelegatePagesToWorkers') && !directPages) throw new Error('This Wrangler can redirect Pages creation to Workers. Set up Pages in Cloudflare, then retry Ship.');
	return { ...target, directory: toPosix(directory), source: source + JSON.stringify([entry, pkg.version, info.size, info.mtimeMs]), entry, version: String(pkg.version), directPages };
}

async function selectedAccount(directory: string, env: NodeJS.ProcessEnv): Promise<string | undefined> {
	const explicit = env.CLOUDFLARE_ACCOUNT_ID || env.CF_ACCOUNT_ID;
	if (explicit) return explicit;
	let closest: string | undefined;
	for (let current = directory; ; current = path.dirname(current)) {
		if (await pathExists(path.join(current, 'node_modules'))) { closest = path.join(current, 'node_modules', '.cache', 'wrangler'); break; }
		if (path.dirname(current) === current) break;
	}
	const local = path.join(directory, '.wrangler', 'cache');
	const folder = env.WRANGLER_CACHE_DIR || (closest && await pathExists(closest) ? closest : await pathExists(local) ? local : closest || local);
	try {
		const cache = JSON.parse(await readFile(path.join(folder, 'pages.json'), 'utf8'));
		return typeof cache.account_id === 'string' ? cache.account_id : undefined;
	} catch (err) {
		if ((err as NodeJS.ErrnoException).code === 'ENOENT') return undefined;
		throw new Error('Wrangler’s cached Pages account is unreadable. Repair it before creating a project.');
	}
}

function jsonOutput(result: CommandResult, label: string): unknown {
	if (!result.ok) throw new Error(label + ': ' + plainPluginError(result.stderr || result.stdout));
	try { return JSON.parse(result.stdout.trim()); }
	catch { throw new Error(label + ': Wrangler did not return JSON. Update the site’s Wrangler or set up Pages in Cloudflare.'); }
}
async function projectExists(local: LocalTarget, accountId: string, io: PagesRuntime): Promise<boolean> {
	const data = jsonOutput(await io.run(local.entry, local.directory, ['pages', 'project', 'list', '--json'], accountId), 'Read Pages projects');
	if (!Array.isArray(data) || data.some((r) => !r || typeof r['Project Name'] !== 'string')) throw new Error('Wrangler returned an unrecognized Pages project list.');
	return data.some((r) => r['Project Name'] === local.projectName);
}
async function inspect(loaded: LoadedManifest, id: string, io: PagesRuntime): Promise<{ plan: PagesProjectPlan; local?: LocalTarget }> {
	const local = await localTarget(loaded, id);
	if (!local) return { plan: { id, action: 'blocked', reason: 'Automatic Pages setup needs a literal wrangler pages deploy script with --project-name and --branch (root or site/).' } };
	const accountHint = await selectedAccount(local.directory, io.env);
	const who = jsonOutput(await io.run(local.entry, local.directory, ['whoami', '--json']), 'Read Cloudflare account') as { loggedIn?: boolean; accounts?: { id: string; name: string }[]; tokenPermissions?: string[] };
	if (who.loggedIn !== true || !Array.isArray(who.accounts) || who.accounts.some((a) => !a || typeof a.name !== 'string' || !/^[a-f0-9]{32}$/i.test(a.id))) throw new Error('Sign in with the site’s Wrangler before setting up Pages.');
	const account = accountHint ? who.accounts.find((a) => a.id === accountHint) : who.accounts.length === 1 ? who.accounts[0] : undefined;
	if (!account) throw new Error('Cloudflare account is ambiguous or unavailable. Set CLOUDFLARE_ACCOUNT_ID for LocalHelm, then open a new plan.');
	if (who.tokenPermissions && !who.tokenPermissions.includes('pages:write')) throw new Error('Wrangler’s sign-in lacks Pages write permission. Refresh its login before creating a project.');
	const exists = await projectExists(local, account.id, io);
	const target: PagesProjectTarget = {
		directory: local.directory, projectName: local.projectName, productionBranch: local.productionBranch,
		accountId: account.id, accountName: account.name, wranglerVersion: local.version,
		revision: createHash('sha256').update(JSON.stringify([local.source, local.directory, local.projectName, local.productionBranch, account.id, account.name, local.directPages])).digest('hex'),
	};
	return { local, plan: { id, target, action: exists ? 'exists' : 'create',
		reason: exists ? 'Pages project already exists. Open a fresh Ship plan.' : 'The Pages project does not exist in this Cloudflare account.' } };
}

export async function planPagesProject(loaded: LoadedManifest, id: string, io = pagesRuntime): Promise<PagesProjectPlan> {
	try { return (await inspect(loaded, id, io)).plan; }
	catch (error) { return { id, action: 'blocked', reason: error instanceof Error ? error.message : String(error) }; }
}
/** Optional Ship preflight. Unsupported/custom scripts retain their existing Ship behavior. */
export async function shipPagesPreflight(loaded: LoadedManifest, id: string, io = pagesRuntime): Promise<PagesProjectPlan | undefined> {
	try { if (!await localTarget(loaded, id)) return undefined; }
	catch { return undefined; }
	return planPagesProject(loaded, id, io);
}

export async function applyPagesProject(loaded: LoadedManifest, id: string, revision: string, io = pagesRuntime): Promise<PagesProjectResult> {
	assertDemoAllowsRepoWrite();
	const { plan, local } = await inspect(loaded, id, io);
	if (!plan.target || !local || !revision || revision !== plan.target.revision) throw new Error('Pages setup changed or is unavailable. Open a new confirmation.');
	if (plan.action === 'exists') return { ...plan, ok: true, writes: false };
	const args = ['pages', 'project', 'create', local.projectName, '--production-branch', local.productionBranch];
	// This flag only opts out of Workers delegation on create. It is never added to deploy or Git commands.
	if (local.directPages) args.push('--force');
	const created = await io.run(local.entry, local.directory, args, plan.target.accountId);
	if (!created.ok) return { ...plan, ok: false, writes: false, reason: 'Pages creation failed: ' + plainPluginError(created.stderr || created.stdout) };
	try {
		if (!await projectExists(local, plan.target.accountId, io)) throw new Error('The project is not visible yet.');
	} catch (error) {
		return { ...plan, ok: false, writes: true, reason: 'Creation returned success, but verification failed. Refresh Pages setup before retrying: ' + String(error) };
	}
	return { ...plan, action: 'exists', ok: true, writes: true, reason: 'Created Pages project. Open a fresh Ship plan to deploy.' };
}
