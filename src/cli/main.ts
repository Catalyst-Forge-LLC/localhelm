import { fleetDeps } from '../lib/deps.js';
import { applyEnroll, applyUnenroll, planEnroll, planUnenroll } from '../lib/enroll.js';
import { findManifest, requireManifest } from '../lib/manifest.js';
import { scanFolders } from '../lib/scan.js';
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

scan never writes. enroll/unenroll print a plan; pass --apply to write the manifest.
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
			await applyEnroll(plan, existing);
			plan.writes = true;
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
			await applyUnenroll(plan, loaded);
			plan.writes = true;
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

	fail(`unknown command: ${cmd}\n\n${usage()}`);
}

main().catch((err: unknown) => {
	fail(err instanceof Error ? err.message : String(err));
});
