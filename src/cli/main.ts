import { applyBump, planBump } from '../lib/bump.js';
import { applyCascade, planCascade } from '../lib/cascade.js';
import { fleetDeps } from '../lib/deps.js';
import { fleetReady } from '../lib/ready.js';
import { applyEnroll, applyUnenroll, planEnroll, planUnenroll } from '../lib/enroll.js';
import { applyExport, planExport } from '../lib/export.js';
import { applyFetch, applyPull, planFetch, planPull, type GitJobRow } from '../lib/git.js';
import { acquireJobLock } from '../lib/lock.js';
import { findManifest, requireManifest } from '../lib/manifest.js';
import { scanFolders } from '../lib/scan.js';
import { serveDashboard } from '../lib/serve.js';
import type { BumpKind } from '../lib/semver.js';
import { fleetStatus } from '../lib/status.js';
import type { EnrollPlan, FleetInventory, ScanCandidate } from '../lib/types.js';

function usage(): string {
	return `localhelm — status for the products you ship

Usage:
  localhelm scan [dir...] [--json] [--max-depth N]
  localhelm enroll <path>... [--npm name] [--group name] [--apply]
  localhelm unenroll <id>... [--apply]
  localhelm status [--json] [--fetch]
  localhelm deps [id] [--json]
  localhelm bump <id> patch|minor|major [--apply]
  localhelm fetch
  localhelm pull [--apply]
  localhelm export [file] [--apply]
  localhelm ready [--json]
  localhelm cascade <id> [--to V] [--apply] [--no-commit]
  localhelm serve [--host ADDR] [--port N]

scan never writes. Mutating commands print a plan; pass --apply to write.
Scan also reads .localhelmignore (and ~/.localhelm/ignore).
`;
}

function fail(message: string, code = 1): never {
	console.error(message);
	process.exit(code);
}

function takeFlag(args: string[], name: string): boolean {
	const i = args.indexOf(name);
	if (i < 0) return false;
	args.splice(i, 1);
	return true;
}

function takeOpt(args: string[], name: string): string | undefined {
	const i = args.indexOf(name);
	if (i < 0) return undefined;
	const value = args[i + 1];
	if (!value || value.startsWith('-')) fail(`missing value for ${name}`);
	args.splice(i, 2);
	return value;
}

function printJson(value: unknown): void {
	process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
}

function formatScan(rows: ScanCandidate[]): string {
	if (rows.length === 0) return 'No candidates. Nothing written.\n';
	const lines = ['path\tid\tnpm\tversion\tgit\tprivate\tsite', ...rows.map((row) =>
		[
			row.path,
			row.id,
			row.npmName ?? '',
			row.version ?? '',
			row.git ? 'git' : '',
			row.private ? 'private' : '',
			row.filepressSite ? 'site' : '',
		].join('\t'),
	)];
	lines.push('', `${rows.length} candidate(s). Nothing written. Enroll selected paths with --apply.`);
	return `${lines.join('\n')}\n`;
}

function formatPlan(plan: EnrollPlan, kind: 'enroll' | 'unenroll'): string {
	const lines = [`Plan: ${kind} → ${plan.manifestPath}`];
	for (const row of plan.rows) {
		const extra = [row.npm, row.group, row.reason].filter(Boolean).join(' · ');
		lines.push(`  ${row.action}\t${row.id}\t${row.path}${extra ? `\t${extra}` : ''}`);
	}
	const adds = plan.rows.filter((r) => r.action === 'add' || (kind === 'unenroll' && r.action === 'update')).length;
	if (!plan.writes) {
		lines.push('', adds ? 'Nothing written. Re-run with --apply to write.' : 'Nothing to apply.');
	} else {
		lines.push('', `Wrote ${plan.manifestPath}`);
	}
	return `${lines.join('\n')}\n`;
}

function formatGitRows(rows: GitJobRow[]): string {
	if (rows.length === 0) return 'No enrolled projects.\n';
	const lines = ['id\taction\treason', ...rows.map((row) => [row.id, row.action, row.reason ?? ''].join('\t'))];
	return `${lines.join('\n')}\n`;
}

function formatStatus(inv: FleetInventory): string {
	const lines = [
		`fleet\t${inv.manifestPath}`,
		`digest\tprojects=${inv.digest.projects} dirty=${inv.digest.dirty} ahead=${inv.digest.unpublishedAhead} cascade=${inv.digest.cascadeBehind} missing=${inv.digest.missing} npm-errors=${inv.digest.npmErrors}`,
		'id\tlocal\tnpm\tgit\tpins\tnotes',
	];
	for (const row of inv.projects) {
		const npm =
			row.npm.status === 'ok'
				? row.npm.latest
				: row.npm.status === 'private'
					? 'private'
					: row.npm.status === 'error'
						? `error:${row.npm.error}`
						: row.npm.status;
		const git = !row.git.repo
			? 'no-git'
			: row.git.error
				? `error:${row.git.error}`
				: [
						row.git.dirty ? 'dirty' : 'clean',
						row.git.branch,
						row.git.ahead != null ? `ahead ${row.git.ahead}` : '',
						row.git.behind != null ? `behind ${row.git.behind}` : '',
						row.git.origin ? '' : 'no-origin',
					]
						.filter(Boolean)
						.join(' ');
		const pins = row.pins.length
			? row.pins
					.map((pin) => {
						if (pin.kind === 'link' || pin.kind === 'file') return `${pin.name}:${pin.kind}`;
						if (pin.onLatest === false) return `${pin.name}:behind`;
						return `${pin.name}:ok`;
					})
					.join(',')
			: '';
		const notes = [
			row.missing ? 'missing' : '',
			row.unpublishedAhead ? 'unpublished-ahead' : '',
			row.git.fetchError ? 'remote-unreadable' : '',
			row.error ?? '',
		]
			.filter(Boolean)
			.join(' ');
		lines.push([row.id, row.localVersion ?? 'n/a', npm ?? 'n/a', git, pins, notes].join('\t'));
	}
	return `${lines.join('\n')}\n`;
}

async function main(): Promise<void> {
	const argv = process.argv.slice(2);
	const cmd = argv.shift();
	if (!cmd || cmd === '-h' || cmd === '--help') {
		process.stdout.write(usage());
		return;
	}
	if (cmd === '-v' || cmd === '--version') {
		process.stdout.write('0.0.0\n');
		return;
	}

	if (cmd === 'scan') {
		const json = takeFlag(argv, '--json');
		const depthRaw = takeOpt(argv, '--max-depth');
		const maxDepth = depthRaw ? Number(depthRaw) : undefined;
		if (depthRaw && !Number.isFinite(maxDepth)) fail('--max-depth must be a number');
		const leftovers = argv.filter((a) => a.startsWith('-'));
		if (leftovers.length) fail(`unknown flag: ${leftovers[0]}`);
		const rows = await scanFolders({ roots: argv, maxDepth });
		if (json) printJson({ candidates: rows });
		else process.stdout.write(formatScan(rows));
		return;
	}

	if (cmd === 'enroll') {
		const apply = takeFlag(argv, '--apply');
		const json = takeFlag(argv, '--json');
		const npm = takeOpt(argv, '--npm');
		const group = takeOpt(argv, '--group');
		const leftovers = argv.filter((a) => a.startsWith('-'));
		if (leftovers.length) fail(`unknown flag: ${leftovers[0]}`);
		if (argv.length === 0) fail('usage: localhelm enroll <path>... [--npm name] [--group name] [--apply]');
		const existing = await findManifest();
		const plan = await planEnroll({ paths: argv, npm, group }, existing);
		if (apply) {
			const root = existing?.workspaceRoot ?? plan.manifestPath.replace(/[/\\][^/\\]+$/, '');
			const lock = await acquireJobLock(root);
			try {
				await applyEnroll(plan, existing);
				plan.writes = true;
			} finally {
				await lock.release();
			}
		}
		if (json) printJson(plan);
		else process.stdout.write(formatPlan(plan, 'enroll'));
		return;
	}

	if (cmd === 'unenroll') {
		const apply = takeFlag(argv, '--apply');
		const json = takeFlag(argv, '--json');
		const leftovers = argv.filter((a) => a.startsWith('-'));
		if (leftovers.length) fail(`unknown flag: ${leftovers[0]}`);
		if (argv.length === 0) fail('usage: localhelm unenroll <id>... [--apply]');
		const loaded = await requireManifest();
		const plan = await planUnenroll(argv, loaded);
		if (apply) {
			const lock = await acquireJobLock(loaded.workspaceRoot);
			try {
				await applyUnenroll(plan, loaded);
				plan.writes = true;
			} finally {
				await lock.release();
			}
		}
		if (json) printJson(plan);
		else process.stdout.write(formatPlan(plan, 'unenroll'));
		return;
	}

	if (cmd === 'status') {
		const json = takeFlag(argv, '--json');
		const fetchRemotes = takeFlag(argv, '--fetch');
		if (argv.length) fail('usage: localhelm status [--json] [--fetch]');
		const loaded = await requireManifest();
		const inventory = await fleetStatus(loaded, { fetch: fetchRemotes });
		if (json) printJson(inventory);
		else process.stdout.write(formatStatus(inventory));
		return;
	}

	if (cmd === 'deps') {
		const json = takeFlag(argv, '--json');
		const leftovers = argv.filter((a) => a.startsWith('-'));
		if (leftovers.length) fail(`unknown flag: ${leftovers[0]}`);
		if (argv.length > 1) fail('usage: localhelm deps [id] [--json]');
		const loaded = await requireManifest();
		const inventory = await fleetStatus(loaded);
		const view = fleetDeps(inventory, argv[0]);
		if (json) printJson(view);
		else {
			const lines = [];
			if (view.cycles.length) lines.push(`cycles\t${view.cycles.map((c) => c.join('→')).join(' ; ')}`);
			for (const pub of view.publishers) {
				lines.push(`${pub.id}\t${pub.npm ?? ''}\t${pub.npmLatest ?? ''}`);
				if (pub.dependents.length === 0) lines.push('  (no enrolled dependents)');
				for (const pin of pub.dependents) {
					lines.push(`  ${pin.fromId}/${pin.fromFile}\t${pin.spec}\t${pin.kind}\t${pin.note ?? (pin.onLatest ? 'on-latest' : 'behind')}`);
				}
			}
			process.stdout.write(`${lines.join('\n')}\n`);
		}
		return;
	}

	if (cmd === 'bump') {
		const apply = takeFlag(argv, '--apply');
		const json = takeFlag(argv, '--json');
		const leftovers = argv.filter((a) => a.startsWith('-'));
		if (leftovers.length) fail(`unknown flag: ${leftovers[0]}`);
		const id = argv[0];
		const kind = argv[1];
		if (!id || (kind !== 'patch' && kind !== 'minor' && kind !== 'major') || argv.length !== 2) {
			fail('usage: localhelm bump <id> patch|minor|major [--apply]');
		}
		const loaded = await requireManifest();
		const plan = await planBump(loaded, id, kind as BumpKind);
		if (apply) {
			if (plan.action !== 'bump') fail(plan.reason ?? `cannot bump ${id}`);
			const lock = await acquireJobLock(loaded.workspaceRoot);
			try {
				await applyBump(plan);
			} finally {
				await lock.release();
			}
		}
		if (json) printJson({ ...plan, writes: apply && plan.action === 'bump' });
		else {
			const line = plan.action === 'bump' ? `${plan.id}\t${plan.from} → ${plan.to}\t${plan.file}` : `${plan.id}\tskip\t${plan.reason ?? ''}`;
			const footer = apply && plan.action === 'bump' ? 'Wrote package.json' : apply ? '' : 'Nothing written. Re-run with --apply to write.';
			process.stdout.write(`${line}${footer ? `\n${footer}` : ''}\n`);
		}
		return;
	}

	if (cmd === 'fetch') {
		const json = takeFlag(argv, '--json');
		if (argv.length) fail('usage: localhelm fetch');
		const loaded = await requireManifest();
		const planned = await planFetch(loaded);
		const lock = await acquireJobLock(loaded.workspaceRoot);
		let rows: GitJobRow[];
		try {
			rows = planned.map((row) => applyFetch(loaded.workspaceRoot, row));
		} finally {
			await lock.release();
		}
		if (json) printJson({ rows });
		else process.stdout.write(formatGitRows(rows));
		return;
	}

	if (cmd === 'pull') {
		const apply = takeFlag(argv, '--apply');
		const json = takeFlag(argv, '--json');
		if (argv.length) fail('usage: localhelm pull [--apply]');
		const loaded = await requireManifest();
		const planned = await planPull(loaded);
		let rows = planned;
		if (apply) {
			const lock = await acquireJobLock(loaded.workspaceRoot);
			try {
				rows = planned.map((row) => applyPull(loaded.workspaceRoot, row));
			} finally {
				await lock.release();
			}
		}
		if (json) printJson({ rows, writes: apply });
		else {
			process.stdout.write(formatGitRows(rows));
			if (!apply) process.stdout.write('Nothing written. Re-run with --apply to pull --ff-only.\n');
		}
		return;
	}

	if (cmd === 'export') {
		const apply = takeFlag(argv, '--apply');
		const json = takeFlag(argv, '--json');
		const leftovers = argv.filter((a) => a.startsWith('-'));
		if (leftovers.length) fail(`unknown flag: ${leftovers[0]}`);
		if (argv.length > 1) fail('usage: localhelm export [file] [--apply]');
		const loaded = await requireManifest();
		const plan = planExport(loaded.workspaceRoot, argv[0]);
		if (apply) {
			const lock = await acquireJobLock(loaded.workspaceRoot);
			try {
				await applyExport(loaded, plan);
			} finally {
				await lock.release();
			}
		}
		if (json) printJson({ ...plan, writes: apply });
		else {
			const footer = apply ? `Wrote ${plan.file}` : 'Nothing written. Re-run with --apply to write.';
			process.stdout.write(`${plan.action}\t${plan.file}\n${footer}\n`);
		}
		return;
	}

	if (cmd === 'ready') {
		const json = takeFlag(argv, '--json');
		if (argv.length) fail('usage: localhelm ready [--json]');
		const loaded = await requireManifest();
		const inventory = await fleetStatus(loaded);
		const view = fleetReady(inventory);
		if (json) printJson(view);
		else {
			if (view.eligible.length === 0) {
				process.stdout.write('No projects are ready to publish. LocalHelm never publishes.\n');
			} else {
				const lines = [
					'id\tlocal\tnpm\tnote',
					...view.eligible.map((row) => `${row.id}\t${row.localVersion ?? ''}\t${row.npmLatest ?? 'none'}\tyou publish this`),
					'',
					'LocalHelm never runs npm publish.',
				];
				process.stdout.write(`${lines.join('\n')}\n`);
			}
		}
		return;
	}

	if (cmd === 'cascade') {
		const apply = takeFlag(argv, '--apply');
		const json = takeFlag(argv, '--json');
		const noCommit = takeFlag(argv, '--no-commit');
		const to = takeOpt(argv, '--to');
		const leftovers = argv.filter((a) => a.startsWith('-'));
		if (leftovers.length) fail(`unknown flag: ${leftovers[0]}`);
		if (argv.length !== 1) fail('usage: localhelm cascade <id> [--to V] [--apply] [--no-commit]');
		const loaded = await requireManifest();
		const plan = await planCascade(loaded, argv[0], { to, commit: !noCommit });
		let result = plan;
		if (apply) {
			const lock = await acquireJobLock(loaded.workspaceRoot);
			try {
				result = await applyCascade(plan);
			} finally {
				await lock.release();
			}
		}
		if (json) printJson({ ...result, writes: apply ? result.rows.some((r) => r.writes) : false });
		else {
			const lines = [
				`cascade\t${result.npm}@${result.to}`,
				result.note,
				...(result.localUnpublished
					? [`local unpublished\t${result.localUnpublished} (targeting npm ${result.to})`]
					: []),
				...(result.cycles.length ? [`cycles\t${result.cycles.map((c) => c.join('→')).join(' ; ')}`] : []),
				'id\tfile\taction\tfrom\tto\treason',
				...result.rows.map((row) =>
					[
						row.fromId,
						row.fromFile,
						row.action,
						row.fromSpec,
						row.toSpec ?? '',
						row.reason ?? (row.committed ? 'committed' : row.writes ? 'wrote' : ''),
					].join('\t'),
				),
			];
			if (!apply) lines.push('', 'Nothing written. Re-run with --apply to write pins and lockfiles.');
			else if (!result.rows.some((r) => r.writes)) lines.push('', 'Nothing written.');
			process.stdout.write(`${lines.join('\n')}\n`);
		}
		return;
	}

	if (cmd === 'serve') {
		const host = takeOpt(argv, '--host');
		const portRaw = takeOpt(argv, '--port');
		const leftovers = argv.filter((a) => a.startsWith('-'));
		if (leftovers.length) fail(`unknown flag: ${leftovers[0]}`);
		if (argv.length) fail('usage: localhelm serve [--host ADDR] [--port N]');
		const port = portRaw ? Number(portRaw) : undefined;
		if (portRaw && (!Number.isFinite(port) || (port as number) <= 0)) fail('--port must be a positive number');
		await serveDashboard({ host, port });
		return;
	}

	fail(`unknown command: ${cmd}\n\n${usage()}`);
}

main().catch((err: unknown) => {
	fail(err instanceof Error ? err.message : String(err));
});
