<script lang="ts">
	import { onMount } from 'svelte';
	import ConfirmModal from '$lib/ConfirmModal.svelte';
	import { pluginPlanWriteIds } from '$lib/pluginPlan';

	type BumpKind = 'patch' | 'minor' | 'major';
	type Pin = {
		name: string;
		spec: string;
		kind: string;
		fromFile: 'root' | 'site';
		targetId?: string;
		onLatest?: boolean;
		note?: string;
	};
	type ReadyRow = { id: string; localVersion: string | null; npmLatest?: string; reason?: string };
	type PublishStep =
		| { kind: 'bump'; from: string; to: string; bumpKind: BumpKind }
		| { kind: 'commit'; message: string }
		| { kind: 'push'; branch: string; origin: string }
		| { kind: 'publish'; name: string; version: string };
	type PublishRow = {
		id: string;
		action: string;
		reason?: string;
		version: string | null;
		npm?: string;
		steps: PublishStep[];
	};
	type CascadeTarget = { id: string; npm: string; latest: string; behind: number; linked: number };
	type PluginBoard = {
		plugin: string;
		title: string;
		note?: string;
		columns: { id: string; label: string }[];
		rows: { id: string; cells: Record<string, string>; actions: { id: string; label: string; write: boolean }[] }[];
	};
	type Project = {
		id: string;
		path: string;
		localVersion: string | null;
		private: boolean;
		missing: boolean;
		unpublishedAhead: boolean;
		cascadeBehind: number;
		error?: string;
		npm: { name?: string; status: string; latest?: string; error?: string };
		git: {
			repo: boolean;
			dirty: boolean;
			branch?: string;
			staged: number;
			unstaged: number;
			untracked: number;
			ahead: number | null;
			behind: number | null;
			origin?: string;
			busy?: string;
			detached?: boolean;
			fetchError?: string;
			error?: string;
		};
		pins: Pin[];
	};
	type Inventory = {
		manifestPath: string;
		digest: {
			projects: number;
			dirty: number;
			unpublishedAhead: number;
			cascadeBehind: number;
			missing: number;
			npmErrors: number;
		};
		projects: Project[];
	};
	type Candidate = {
		path: string;
		absPath: string;
		id: string;
		npmName?: string;
		version?: string;
		git: boolean;
		private?: boolean;
	};
	type GitRow = {
		id: string;
		action: string;
		reason?: string;
		origin?: string;
		branch?: string;
		ahead?: number | null;
	};
	type BumpPlan = { id: string; from: string | null; to: string | null; action: string; reason?: string };
	type LogEntry = { time: string; title: string; body: string };
	type TabId = 'today' | 'fleet' | 'sites';

	let inventory = $state<Inventory | null>(null);
	let tab = $state<TabId>('today');
	let cwd = $state('');
	let port = $state<string | null>(null);
	let portSource = $state<string | null>(null);
	let fetchedAt = $state<string | null>(null);

	let scanRoot = $state('..');
	let candidates = $state<Candidate[]>([]);
	let selectedScan = $state<Record<string, boolean>>({});
	let selectedIds = $state<Record<string, boolean>>({});
	let bumpKind = $state<Record<string, BumpKind>>({});

	// A plan must be seen before its apply button unlocks. Any refresh clears them.
	let plannedPull = $state<number | null>(null);
	let plannedPush = $state<GitRow[] | null>(null);
	let plannedExport = $state<string | null>(null);
	let plannedEnroll = $state<string | null>(null);
	let plannedUnenroll = $state<string | null>(null);
	let plannedBump = $state<Record<string, string>>({});
	let plannedCascade = $state<string | null>(null);
	let pluginBoards = $state<PluginBoard[]>([]);
	let plannedPlugin = $state<string | null>(null);
	let plannedPluginWrites = $state<string[]>([]);
	let plannedPublish = $state<Record<string, PublishRow>>({});
	let publishOtp = $state('');
	let npmUser = $state<string | null>(null);
	let publishAuthHint = $state(
		'Run localhelm auth and put a granular automation token (Bypass 2FA) in your user ~/.npmrc before you publish. LocalHelm never stores the token.',
	);
	let confirmOpen = $state(false);
	let confirmTitle = $state('');
	let confirmHint = $state('');
	let confirmLabel = $state('Confirm');
	let confirmVariant = $state<'write' | 'danger'>('write');
	let confirmItems = $state<string[]>([]);
	let confirmRun = $state<(() => void) | null>(null);

	let entries = $state<LogEntry[]>([]);
	let busy = $state('');
	let error = $state('');

	const enrolledIds = $derived(new Set((inventory?.projects ?? []).map((p) => p.id)));
	const checkedScan = $derived(
		Object.entries(selectedScan)
			.filter(([, on]) => on)
			.map(([p]) => p),
	);
	const checkedIds = $derived(
		Object.entries(selectedIds)
			.filter(([, on]) => on)
			.map(([id]) => id),
	);
	const staleRemotes = $derived(
		(inventory?.projects ?? []).some((p) => p.git.repo && Boolean(p.git.fetchError)),
	);
	const readyRows = $derived(
		(inventory?.projects ?? [])
			.filter(
				(row) =>
					row.unpublishedAhead &&
					!row.private &&
					!row.missing &&
					row.git.repo &&
					!row.git.dirty &&
					!row.git.busy &&
					!row.git.detached,
			)
			.map(
				(row): ReadyRow => ({
					id: row.id,
					localVersion: row.localVersion,
					npmLatest: row.npm.latest,
				}),
			),
	);
	const shipRows = $derived(
		(inventory?.projects ?? []).filter((row) => !row.private && !row.missing && Boolean(row.npm.name)),
	);
	const plannedShipIds = $derived(
		shipRows.map((row) => row.id).filter((id) => plannedPublish[id]?.action === 'publish'),
	);
	const cascadeTargets = $derived.by((): CascadeTarget[] => {
		const projects = inventory?.projects ?? [];
		return projects
			.map((pub) => {
				const pins = projects.flatMap((other) => other.pins.filter((pin) => pin.targetId === pub.id));
				const behind = pins.filter((pin) => pin.kind === 'registry' && pin.onLatest === false).length;
				const linked = pins.filter((pin) => pin.kind === 'link' || pin.kind === 'file').length;
				return {
					id: pub.id,
					npm: pub.npm.name ?? pub.id,
					latest: pub.npm.latest ?? '',
					behind,
					linked,
				};
			})
			.filter((row) => row.behind > 0 || row.linked > 0);
	});
	const attentionRows = $derived((inventory?.projects ?? []).filter((row) => rowNeedsYou(row)));
	const filepressBoard = $derived(pluginBoards.find((board) => board.plugin === 'filepress') ?? pluginBoards[0] ?? null);
	const sitesNeedingYou = $derived((filepressBoard?.rows ?? []).filter((row) => siteNeedsYou(row.cells)));
	const cascadeOnlyRows = $derived(
		cascadeTargets.filter((target) => !attentionRows.some((row) => row.id === target.id)),
	);
	const todayCount = $derived(attentionRows.length + cascadeOnlyRows.length + sitesNeedingYou.length);
	const filepressSyncIds = $derived(
		(filepressBoard?.rows ?? [])
			.filter((row) => row.actions.some((act) => act.id === 'sync'))
			.map((row) => row.id),
	);

	function setTab(next: TabId): void {
		tab = next;
		try {
			sessionStorage.setItem('localhelm.tab', next);
		} catch {
			/* ignore quota / private mode */
		}
	}

	function rowNeedsYou(row: Project): boolean {
		return badges(row).some((badge) => badge.text !== 'nothing to do');
	}

	function siteNeedsYou(cells: Record<string, string>): boolean {
		const update = (cells.update ?? '').trim().toLowerCase();
		const headers = (cells.headers ?? '').trim().toLowerCase();
		const git = (cells.git ?? '').trim().toLowerCase();
		const updateStale = Boolean(update) && update !== '—' && !update.startsWith('already') && !update.startsWith('skip');
		return updateStale || headers.startsWith('merge') || git === 'dirty';
	}

	function canPublish(row: Project): boolean {
		return !row.private && !row.missing && Boolean(row.npm.name);
	}

	function cascadeFor(id: string): CascadeTarget | undefined {
		return cascadeTargets.find((row) => row.id === id);
	}

	function clearPlans(): void {
		plannedPull = null;
		plannedPush = null;
		plannedExport = null;
		plannedBump = {};
		plannedUnenroll = null;
		plannedEnroll = null;
		plannedCascade = null;
		plannedPlugin = null;
		plannedPluginWrites = [];
		plannedPublish = {};
	}

	async function call(url: string, init?: RequestInit): Promise<unknown> {
		const res = await fetch(url, {
			...init,
			headers: { 'content-type': 'application/json', ...(init?.headers ?? {}) },
		});
		const data = (await res.json()) as { error?: string };
		if (!res.ok) throw new Error(data.error ?? res.statusText);
		return data;
	}

	function note(title: string, data: unknown): void {
		const time = new Date().toLocaleTimeString();
		entries = [{ time, title, body: JSON.stringify(data, null, 2) }, ...entries].slice(0, 40);
	}

	async function run(label: string, fn: () => Promise<void>): Promise<void> {
		busy = label;
		error = '';
		try {
			await fn();
		} catch (err) {
			error = err instanceof Error ? err.message : String(err);
		} finally {
			busy = '';
			confirmOpen = false;
			confirmRun = null;
		}
	}

	async function refresh(fetchRemotes = false): Promise<void> {
		await run(fetchRemotes ? 'fetching remotes, then reading status' : 'reading status', async () => {
			const data = (await call(`/api/status${fetchRemotes ? '?fetch=1' : ''}`)) as {
				inventory: Inventory | null;
				scanRoot: string;
				cwd: string;
				port: string | null;
				portSource: string | null;
			};
			inventory = data.inventory;
			cwd = data.cwd;
			port = data.port;
			portSource = data.portSource;
			if (fetchRemotes) fetchedAt = new Date().toLocaleTimeString();
			if (!candidates.length) scanRoot = data.scanRoot;
			const kinds = { ...bumpKind };
			for (const row of data.inventory?.projects ?? []) kinds[row.id] ??= 'patch';
			bumpKind = kinds;
			clearPlans();
			try {
				const plug = (await call('/api/plugins')) as { boards: PluginBoard[] };
				pluginBoards = plug.boards;
			} catch {
				pluginBoards = [];
			}
		});
	}

	async function scan(): Promise<void> {
		await run(`scanning ${scanRoot}`, async () => {
			const data = (await call('/api/scan', {
				method: 'POST',
				body: JSON.stringify({ roots: [scanRoot] }),
			})) as { candidates: Candidate[] };
			candidates = data.candidates;
			selectedScan = {};
			plannedEnroll = null;
			note(`scan ${scanRoot} — ${data.candidates.length} candidate(s), nothing written`, data);
		});
	}

	async function enroll(apply: boolean): Promise<void> {
		if (!checkedScan.length) {
			error = 'Check at least one scanned folder first.';
			return;
		}
		const signature = [...checkedScan].sort().join('|');
		await run(apply ? 'enrolling' : 'planning enroll', async () => {
			const plan = await call('/api/enroll', {
				method: 'POST',
				body: JSON.stringify({ paths: checkedScan, apply }),
			});
			note(apply ? `enrolled ${checkedScan.length} project(s)` : `enroll plan — ${checkedScan.length} project(s), nothing written`, plan);
			if (apply) {
				selectedScan = {};
				await refresh();
			} else {
				plannedEnroll = signature;
			}
		});
	}

	async function unenroll(apply: boolean): Promise<void> {
		if (!checkedIds.length) {
			error = 'Check at least one fleet row first.';
			return;
		}
		const signature = [...checkedIds].sort().join('|');
		await run(apply ? 'removing from fleet' : 'planning unenroll', async () => {
			const plan = await call('/api/unenroll', {
				method: 'POST',
				body: JSON.stringify({ ids: checkedIds, apply }),
			});
			note(apply ? `removed ${checkedIds.length} project(s) from the fleet` : `unenroll plan — ${checkedIds.length} row(s), nothing written`, plan);
			if (apply) {
				selectedIds = {};
				await refresh();
			} else {
				plannedUnenroll = signature;
			}
		});
	}

	async function bump(id: string, apply: boolean): Promise<void> {
		const kind = bumpKind[id] ?? 'patch';
		await run(apply ? `bumping ${id}` : `planning ${kind} bump for ${id}`, async () => {
			const plan = (await call('/api/bump', {
				method: 'POST',
				body: JSON.stringify({ id, kind, apply }),
			})) as BumpPlan;
			if (apply) {
				note(`bumped ${id} to ${plan.to}`, plan);
				await refresh();
				return;
			}
			if (plan.action !== 'bump') {
				error = `${id}: ${plan.reason ?? 'cannot bump'}`;
				note(`bump plan ${id} — skipped`, plan);
				return;
			}
			plannedBump = { ...plannedBump, [id]: `${kind}:${plan.to}` };
			note(`bump plan ${id} ${plan.from} → ${plan.to}, nothing written`, plan);
		});
	}

	async function fetchOrigins(): Promise<void> {
		await run('git fetch origin in every repo', async () => {
			const data = (await call('/api/fetch', { method: 'POST' })) as { rows: GitRow[] };
			const failed = data.rows.filter((r) => r.action === 'fetch' && r.reason !== 'fetched');
			note(`fetch — ${data.rows.filter((r) => r.reason === 'fetched').length} fetched, ${failed.length} failed`, data);
			await refresh();
		});
	}

	async function pull(apply: boolean): Promise<void> {
		await run(apply ? 'pulling (fast-forward only)' : 'planning pull', async () => {
			const data = (await call('/api/pull', { method: 'POST', body: JSON.stringify({ apply }) })) as {
				rows: GitRow[];
			};
			const eligible = data.rows.filter((r) => r.action === 'pull');
			if (apply) {
				note(`pull --apply — ${eligible.length} repo(s) fast-forwarded`, data);
				await refresh();
				return;
			}
			plannedPull = eligible.length;
			note(`pull plan — ${eligible.length} of ${data.rows.length} eligible, nothing written`, data);
		});
	}

	function askConfirm(spec: {
		title: string;
		hint: string;
		items: string[];
		confirmLabel: string;
		variant: 'write' | 'danger';
		run: () => void;
	}): void {
		confirmTitle = spec.title;
		confirmHint = spec.hint;
		confirmItems = spec.items;
		confirmLabel = spec.confirmLabel;
		confirmVariant = spec.variant;
		confirmRun = spec.run;
		confirmOpen = true;
	}

	function pushItems(rows: GitRow[]): string[] {
		return rows.map((row) => {
			const n = row.ahead ?? '?';
			return `${row.id}  ${row.branch ?? '?'}  ${n} commit(s)  →  ${row.origin ?? ''}`;
		});
	}

	async function runPush(apply: boolean): Promise<void> {
		await run(apply ? 'pushing to origin' : 'planning push all', async () => {
			const ids = apply ? (plannedPush ?? []).map((row) => row.id) : undefined;
			const data = (await call('/api/push', { method: 'POST', body: JSON.stringify({ apply, ids }) })) as {
				rows: GitRow[];
			};
			const eligible = data.rows.filter((r) => r.action === 'push');
			if (apply) {
				const failed = eligible.filter((r) => r.reason !== 'pushed');
				note(
					`push --apply — ${eligible.filter((r) => r.reason === 'pushed').length} pushed, ${failed.length} failed`,
					data,
				);
				await refresh();
				return;
			}
			plannedPush = eligible;
			note(`push plan — ${eligible.length} of ${data.rows.length} eligible (origin only), nothing written`, data);
		});
	}

	function requestPush(): void {
		const rows = plannedPush ?? [];
		if (rows.length === 0) return;
		askConfirm({
			title: 'Push these branches to origin?',
			hint: 'git push origin only. Never --force. Never the IngotVault backup remote.',
			items: pushItems(rows),
			confirmLabel: `Push ${rows.length} to origin`,
			variant: 'write',
			run: () => void runPush(true),
		});
	}

	function publishItems(row: PublishRow): string[] {
		const lines = [`${row.id}  ${row.npm ?? ''}@${row.version ?? '?'}`];
		let n = 0;
		for (const step of row.steps) {
			if (step.kind === 'commit') {
				lines.push(`   commit: ${step.message}`);
				continue;
			}
			n += 1;
			if (step.kind === 'bump') lines.push(`${n}. bump ${step.from} → ${step.to} (${step.bumpKind}) and commit`);
			else if (step.kind === 'push') lines.push(`${n}. git push origin ${step.branch} → ${step.origin}`);
			else lines.push(`${n}. npm publish ${step.name}@${step.version}`);
		}
		return lines;
	}

	async function runPublish(ids: string[], apply: boolean): Promise<void> {
		const label = ids.length === 1 ? ids[0] : `${ids.length} packages`;
		await run(apply ? `publishing ${label}` : `planning publish ${label}`, async () => {
			const data = (await call('/api/publish', {
				method: 'POST',
				body: JSON.stringify({
					apply,
					ids,
					kind: ids.length === 1 ? (bumpKind[ids[0] ?? ''] ?? 'patch') : 'patch',
					otp: apply && publishOtp.trim() ? publishOtp.trim() : undefined,
				}),
			})) as { rows: PublishRow[]; npmUser?: string | null; authHint?: string };
			if (!apply) {
				if (data.authHint) publishAuthHint = data.authHint;
				npmUser = data.npmUser ?? null;
			}
			if (apply) {
				const published = data.rows.filter((r) => r.reason?.startsWith('published ')).length;
				note(`publish --apply — ${published} published`, { rows: data.rows });
				publishOtp = '';
				await refresh();
				return;
			}
			const next = { ...plannedPublish };
			for (const row of data.rows) {
				if (row.action === 'publish') next[row.id] = row;
			}
			plannedPublish = next;
			const eligible = data.rows.filter((r) => r.action === 'publish');
			if (eligible.length === 0 && ids.length === 1) {
				error = `${ids[0]}: ${data.rows[0]?.reason ?? 'cannot publish'}`;
			}
			note(`publish plan — ${eligible.length} of ${data.rows.length} eligible, nothing written`, data);
		});
	}

	function requestPublish(ids: string[]): void {
		const rows = ids.map((id) => plannedPublish[id]).filter((row): row is PublishRow => row?.action === 'publish');
		if (rows.length === 0) return;
		askConfirm({
			title: rows.length === 1 ? 'Publish this package?' : `Publish ${rows.length} packages?`,
			hint: publishAuthHint,
			items: rows.flatMap(publishItems),
			confirmLabel: rows.length === 1 ? `Publish ${rows[0]?.version}` : `Publish ${rows.length}`,
			variant: 'danger',
			run: () => void runPublish(ids, true),
		});
	}

	function pluginKey(plugin: string, action: string, ids: string[]): string {
		return `${plugin}:${action}:${[...ids].sort().join(',')}`;
	}

	function pluginJobPlanned(plugin: string, action: string, ids: string[]): boolean {
		return plannedPlugin === pluginKey(plugin, action, ids);
	}

	function pluginJobWriteReady(plugin: string, action: string, ids: string[]): boolean {
		return pluginJobPlanned(plugin, action, ids) && plannedPluginWrites.length > 0;
	}

	function pluginRowWriteReady(plugin: string, action: string, id: string): boolean {
		return plannedPlugin === pluginKey(plugin, action, [id]) && plannedPluginWrites.includes(id);
	}

	function syncAllLabel(plugin: string, ids: string[]): string {
		if (!pluginJobPlanned(plugin, 'sync', ids)) return 'Sync all';
		return plannedPluginWrites.length ? `Sync ${plannedPluginWrites.length} sites` : 'Already current';
	}

	async function runPluginJob(plugin: string, action: string, ids: string[], apply: boolean): Promise<void> {
		const key = pluginKey(plugin, action, ids);
		const scope = ids.length ? `${ids.length} site(s)` : 'all sites';
		await run(apply ? `${plugin} ${action} ${scope}` : `planning ${plugin} ${action} ${scope}`, async () => {
			const data = await call('/api/plugin', {
				method: 'POST',
				body: JSON.stringify({ id: plugin, action, ids, apply }),
			});
			note(apply ? `${plugin} ${action} --apply ${scope}` : `${plugin} ${action} plan ${scope}`, data);
			if (apply) await refresh();
			else {
				plannedPlugin = key;
				plannedPluginWrites = pluginPlanWriteIds(data) ?? [...ids];
			}
		});
	}

	function requestPluginJob(plugin: string, action: string, ids: string[], label: string): void {
		if (ids.length === 0) return;
		askConfirm({
			title: `${label} for ${ids.length === 1 ? ids[0] : `${ids.length} sites`}?`,
			hint: 'The FilePress plugin runs this in each listed checkout. LocalHelm does not reimplement it.',
			items: ids,
			confirmLabel: ids.length === 1 ? label : `${label} ${ids.length}`,
			variant: 'write',
			run: () => void runPluginJob(plugin, action, ids, true),
		});
	}

	async function cascade(id: string, apply: boolean): Promise<void> {
		await run(apply ? `cascading ${id}` : `planning cascade ${id}`, async () => {
			const data = (await call('/api/cascade', {
				method: 'POST',
				body: JSON.stringify({ id, apply }),
			})) as { to: string; npm: string; rows: { action: string; writes?: boolean }[]; note: string };
			const n = data.rows.filter((r) => r.action === 'retarget').length;
			if (apply) {
				note(`cascade ${data.npm}@${data.to} — wrote ${data.rows.filter((r) => r.writes).length} pin(s)`, data);
				await refresh();
				return;
			}
			plannedCascade = `${id}@${data.to}`;
			note(`cascade plan ${data.npm}@${data.to} — ${n} pin(s) to retarget. ${data.note}`, data);
		});
	}

	async function exportFile(apply: boolean): Promise<void> {
		await run(apply ? 'writing the JSON export' : 'planning export', async () => {
			const data = (await call('/api/export', { method: 'POST', body: JSON.stringify({ apply }) })) as {
				file: string;
			};
			if (apply) {
				note(`export --apply — wrote ${data.file}`, data);
				return;
			}
			plannedExport = data.file;
			note(`export plan — would write ${data.file}, nothing written`, data);
		});
	}

	// The write button only unlocks for the exact kind that was planned.
	function plannedTarget(id: string): string | null {
		const entry = plannedBump[id];
		if (!entry) return null;
		const [kind, to] = entry.split(':');
		return kind === (bumpKind[id] ?? 'patch') ? to : null;
	}

	function plainGitError(raw: string): string {
		if (/permission denied \(publickey\)/i.test(raw)) return 'origin rejected the SSH key';
		if (/authentication failed|could not read username/i.test(raw)) return 'origin needs credentials';
		if (/timed out|operation timed out/i.test(raw)) return 'origin timed out';
		if (/could not resolve host/i.test(raw)) return 'origin host not found';
		if (/could not read from remote/i.test(raw)) return 'origin unreachable';
		return raw.split('\n')[0].slice(0, 90);
	}

	function gitSummary(row: Project): string {
		if (row.missing) return 'folder missing';
		if (!row.git.repo) return 'not a git repo';
		if (row.git.error) return plainGitError(row.git.error);
		const parts = [row.git.branch ?? 'detached', row.git.dirty ? 'dirty' : 'clean'];
		if (row.git.ahead) parts.push(`${row.git.ahead} to push`);
		if (row.git.behind) parts.push(`${row.git.behind} to pull`);
		if (!row.git.ahead && !row.git.behind && row.git.origin) parts.push('in sync');
		if (!row.git.origin) parts.push('no origin');
		return parts.join(' · ');
	}

	function dirtDetail(row: Project): string {
		const bits = [
			row.git.staged ? `${row.git.staged} staged` : '',
			row.git.unstaged ? `${row.git.unstaged} changed` : '',
			row.git.untracked ? `${row.git.untracked} untracked` : '',
		].filter(Boolean);
		return bits.join(', ');
	}

	function npmLabel(row: Project): string {
		if (row.private) return 'private';
		if (row.npm.status === 'ok') return row.npm.latest ?? '—';
		if (row.npm.status === 'none') return 'not published';
		if (row.npm.status === 'error') return 'lookup failed';
		return row.npm.status;
	}

	type Badge = { text: string; tone: 'ship' | 'warn' | 'bad' | 'info'; title?: string };

	function badges(row: Project): Badge[] {
		const out: Badge[] = [];
		if (row.missing) out.push({ text: 'folder missing', tone: 'bad' });
		if (row.unpublishedAhead) {
			out.push({
				text: row.npm.latest ? `unpublished ${row.localVersion} (npm ${row.npm.latest})` : `never published ${row.localVersion}`,
				tone: 'ship',
				title: 'Local version is ahead of npm. Plan publish to push (if needed) and npm publish.',
			});
		}
		if (row.git.dirty) out.push({ text: `dirty${dirtDetail(row) ? ` — ${dirtDetail(row)}` : ''}`, tone: 'warn' });
		if (row.git.busy) out.push({ text: `mid-${row.git.busy}`, tone: 'bad' });
		if (row.cascadeBehind) {
			out.push({ text: `${row.cascadeBehind} pin(s) behind`, tone: 'warn', title: 'A dependency pin would not install the published version. Plan a cascade on that package.' });
		}
		if (row.git.fetchError) {
			out.push({
				text: `remote not read — ${plainGitError(row.git.fetchError)}`,
				tone: 'info',
				title: `Ahead/behind may be stale.\n\n${row.git.fetchError}`,
			});
		}
		if (row.npm.status === 'error') out.push({ text: 'npm lookup failed', tone: 'bad', title: row.npm.error });
		if (row.error) out.push({ text: 'package.json unreadable', tone: 'bad', title: row.error });
		if (out.length === 0) out.push({ text: 'nothing to do', tone: 'info' });
		return out;
	}

	function pinLabel(pin: Pin): string {
		if (pin.kind === 'link' || pin.kind === 'file') return `${pin.name} ${pin.kind}:`;
		return `${pin.name} ${pin.spec}`;
	}

	function pinTone(pin: Pin): string {
		if (pin.kind === 'link' || pin.kind === 'file') return 'pin-local';
		return pin.onLatest === false ? 'pin-behind' : 'pin-ok';
	}

	onMount(() => {
		try {
			const saved = sessionStorage.getItem('localhelm.tab');
			if (saved === 'today' || saved === 'fleet' || saved === 'sites') tab = saved;
		} catch {
			/* ignore */
		}
		void refresh();
	});
</script>

<svelte:head>
	<title>LocalHelm</title>
</svelte:head>

<div class="shell">
	<header>
		<div class="head-row">
			<div class="brand">
				<img class="mark" src="/logo.png" alt="" width="96" height="64" />
				<div>
				<p class="eyebrow">LocalHelm</p>
				<h1>Status for the products you ship</h1>
				<p class="sub">
					{#if inventory}
						Fleet <code>{inventory.manifestPath}</code>
					{:else}
						No fleet yet — open the Fleet tab, scan a folder, then enroll.
					{/if}
					{#if port}
						<span class="dim">
							· serving 127.0.0.1:{port}{portSource === 'localberth'
								? ' (port leased from LocalBerth)'
								: portSource === 'flag'
									? ' (--port)'
									: ''}
						</span>
					{/if}
				</p>
				</div>
			</div>

			<div class="actions">
				<div class="group">
					<span class="group-label">Read — changes nothing</span>
					<div class="group-buttons">
						<button class="btn" disabled={Boolean(busy)} onclick={() => refresh()} title="Re-read package.json, git, and npm latest. Clears the in-process npm cache.">
							Refresh status
						</button>
						<button
							class="btn"
							disabled={Boolean(busy)}
							onclick={() => refresh(true)}
							title="git fetch origin in each repo, then re-read. Updates the to push / to pull counts."
						>
							Refresh + fetch remotes
						</button>
						<button class="btn" disabled={Boolean(busy)} onclick={() => fetchOrigins()} title="git fetch origin only, with a per-repo result log.">
							Fetch only
						</button>
					</div>
				</div>

				<div class="group group-write">
					<span class="group-label">Write — plan, then apply</span>
					<div class="group-buttons">
						<button class="btn" disabled={Boolean(busy)} onclick={() => pull(false)} title="List repos that are clean and behind. Writes nothing.">
							Plan pull
						</button>
						<button
							class="btn btn-write"
							disabled={Boolean(busy) || plannedPull === null || plannedPull === 0}
							onclick={() => pull(true)}
							title={plannedPull === null
								? 'Run Plan pull first.'
								: plannedPull === 0
									? 'Nothing is eligible: repos must be clean and behind.'
									: 'git pull --ff-only on the eligible repos.'}
						>
							{plannedPull === null ? 'Pull' : `Pull ${plannedPull} repo${plannedPull === 1 ? '' : 's'}`}
						</button>
						<button class="btn" disabled={Boolean(busy)} onclick={() => runPush(false)} title="Plan git push origin for every enrolled repo that is clean and ahead.">
							Plan push all
						</button>
						<button
							class="btn btn-write"
							disabled={Boolean(busy) || plannedPush === null || plannedPush.length === 0}
							onclick={() => requestPush()}
							title={plannedPush === null
								? 'Run Plan push all first. You will confirm each origin URL in a modal.'
								: plannedPush.length === 0
									? 'Nothing is eligible: repos must be clean, ahead, and not diverged.'
									: 'git push origin <branch> on the planned repos. Never --force.'}
						>
							{plannedPush === null
								? 'Push all'
								: `Push ${plannedPush.length} to origin`}
						</button>
						<button class="btn" disabled={Boolean(busy)} onclick={() => exportFile(false)} title="Show where the JSON inventory would be written.">
							Plan export
						</button>
						<button
							class="btn btn-write"
							disabled={Boolean(busy) || !plannedExport}
							onclick={() => exportFile(true)}
							title={plannedExport ? `Write ${plannedExport}` : 'Run Plan export first.'}
						>
							Write JSON
						</button>
					</div>
				</div>
			</div>
		</div>

		{#if inventory}
			<div class="chips">
				<button type="button" class="chip" onclick={() => setTab('fleet')}>{inventory.digest.projects} enrolled</button>
				<button type="button" class="chip" class:hot={inventory.digest.unpublishedAhead > 0} onclick={() => setTab('today')}>
					{inventory.digest.unpublishedAhead} unpublished
				</button>
				<button type="button" class="chip" class:warm={inventory.digest.dirty > 0} onclick={() => setTab('today')}>
					{inventory.digest.dirty} dirty
				</button>
				<button type="button" class="chip" class:warm={inventory.digest.cascadeBehind > 0} onclick={() => setTab('today')}>
					{inventory.digest.cascadeBehind} pins behind
				</button>
				<button type="button" class="chip" class:bad={inventory.digest.missing > 0} onclick={() => setTab('today')}>
					{inventory.digest.missing} missing
				</button>
				<button type="button" class="chip" class:bad={inventory.digest.npmErrors > 0} onclick={() => setTab('today')}>
					{inventory.digest.npmErrors} npm errors
				</button>
				<span class="chip quiet">
					{fetchedAt ? `remotes fetched ${fetchedAt}` : 'remotes not fetched this session'}
				</span>
			</div>
		{/if}

		{#if busy}<p class="line busy">Working: {busy}…</p>{/if}
		{#if error}<p class="line err">{error}</p>{/if}
		{#if !busy && !error && staleRemotes}
			<p class="line info">Some remotes could not be read, so “to push / to pull” may be stale. Local state below is accurate.</p>
		{/if}
	</header>

	<nav class="tabs" aria-label="Dashboard views">
		<button type="button" class="tab" class:active={tab === 'today'} class:hot={todayCount > 0} onclick={() => setTab('today')}>
			Today
			{#if todayCount > 0}<span class="count">{todayCount}</span>{/if}
		</button>
		<button type="button" class="tab" class:active={tab === 'fleet'} onclick={() => setTab('fleet')}>
			Fleet
			{#if inventory}<span class="count quiet">{inventory.digest.projects}</span>{/if}
		</button>
		<button type="button" class="tab" class:active={tab === 'sites'} onclick={() => setTab('sites')}>
			Sites
			{#if filepressBoard}<span class="count quiet">{filepressBoard.rows.length}</span>{/if}
		</button>
	</nav>

	<main>
		{#if tab === 'today'}
			<div class="today-grid">
				<section class="panel">
					<div class="section-head">
						<div>
							<h2>Needs you</h2>
							<p class="hint">
								Packages that need a publish, cascade, or a look. Each name appears once.
								{#if readyRows.length}
									{readyRows.length} already unpublished-ahead.
								{/if}
							</p>
						</div>
						{#if (inventory?.digest.unpublishedAhead ?? 0) > 0 || plannedShipIds.length}
							<div class="group-buttons">
								<button
									class="btn"
									disabled={Boolean(busy) || shipRows.length === 0}
									onclick={() => runPublish(shipRows.map((row) => row.id), false)}
									title="Plan publish for every public enrolled package."
								>
									Plan publish all
								</button>
								<button
									class="btn btn-write"
									disabled={Boolean(busy) || plannedShipIds.length === 0}
									onclick={() => requestPublish(plannedShipIds)}
									title={plannedShipIds.length ? `Publish ${plannedShipIds.length} planned package(s).` : 'Run Plan publish all (or plan a card) first.'}
								>
									{plannedShipIds.length ? `Publish ${plannedShipIds.length}` : 'Publish all'}
								</button>
							</div>
						{/if}
					</div>

					{#if (inventory?.digest.unpublishedAhead ?? 0) > 0 || plannedShipIds.length}
						<p class="dim small">
							{#if npmUser}
								npm is logged in as <code>{npmUser}</code>.
							{:else}
								npm is not ready. Run <code>localhelm auth</code> and set a granular automation token in your user <code>~/.npmrc</code> before you publish.
							{/if}
						</p>
						<label for="publish-otp">Authenticator OTP only if npm asks for a numeric code</label>
						<input id="publish-otp" bind:value={publishOtp} autocomplete="one-time-code" spellcheck="false" placeholder="optional" />
					{/if}

					{#if attentionRows.length === 0 && cascadeOnlyRows.length === 0}
						<p class="quiet-banner">All quiet on the fleet. Open Fleet for the full table, or Sites for FilePress.</p>
					{:else}
						<ul class="need-list">
							{#each attentionRows as row (row.id)}
								{@const cascadeTarget = cascadeFor(row.id)}
								<li class="need-card">
									<div class="need-head">
										<div>
											<div class="id">{row.id}</div>
											<div class="dim small">{row.npm.name ?? row.path} · {gitSummary(row)}</div>
										</div>
										<div class="badges">
											{#each badges(row).filter((badge) => badge.text !== 'nothing to do') as badge (badge.text)}
												<span class={`badge ${badge.tone}`} title={badge.title ?? ''}>{badge.text}</span>
											{/each}
										</div>
									</div>
									{#if canPublish(row) && (row.unpublishedAhead || row.npm.status === 'none')}
										<div class="bump">
											<select aria-label={`publish bump kind for ${row.id}`} bind:value={bumpKind[row.id]} disabled={row.unpublishedAhead}>
												<option value="patch">patch</option>
												<option value="minor">minor</option>
												<option value="major">major</option>
											</select>
											<button class="btn btn-sm" disabled={Boolean(busy)} onclick={() => runPublish([row.id], false)}>
												Plan publish
											</button>
											<button
												class="btn btn-sm btn-write"
												disabled={Boolean(busy) || plannedPublish[row.id]?.action !== 'publish'}
												onclick={() => requestPublish([row.id])}
												title={plannedPublish[row.id]?.action === 'publish'
													? plannedPublish[row.id]?.reason
													: 'Run Plan publish first. You will confirm the registry version.'}
											>
												{plannedPublish[row.id]?.action === 'publish'
													? `Publish ${plannedPublish[row.id]?.version}`
													: 'Publish'}
											</button>
										</div>
									{/if}
									{#if cascadeTarget}
										<div class="dim small cascade-note">
											Dependents still on an old {cascadeTarget.npm} pin
											{cascadeTarget.behind ? ` · ${cascadeTarget.behind} behind` : ''}
											{cascadeTarget.linked ? ` · ${cascadeTarget.linked} local link` : ''}
										</div>
										<div class="bump">
											<button class="btn btn-sm" disabled={Boolean(busy)} onclick={() => cascade(row.id, false)}>
												Plan cascade
											</button>
											<button
												class="btn btn-sm btn-write"
												disabled={Boolean(busy) || !plannedCascade?.startsWith(`${row.id}@`)}
												onclick={() => cascade(row.id, true)}
												title={plannedCascade?.startsWith(`${row.id}@`)
													? `Write pins and lockfiles for ${plannedCascade}. Commits by default.`
													: 'Run Plan cascade first.'}
											>
												{plannedCascade?.startsWith(`${row.id}@`) ? `Write ${plannedCascade.slice(row.id.length + 1)}` : 'Write pins'}
											</button>
										</div>
									{/if}
								</li>
							{/each}
							{#each cascadeOnlyRows as target (target.id)}
								<li class="need-card">
									<div class="need-head">
										<div>
											<div class="id">{target.id}</div>
											<div class="dim small">
												{target.npm}{target.latest ? `@${target.latest}` : ''} is published — dependents still need the pin
											</div>
										</div>
										<div class="badges">
											{#if target.behind}<span class="badge warn">{target.behind} pin(s) behind</span>{/if}
											{#if target.linked}<span class="badge info">{target.linked} local link</span>{/if}
										</div>
									</div>
									<div class="bump">
										<button class="btn btn-sm" disabled={Boolean(busy)} onclick={() => cascade(target.id, false)}>
											Plan cascade
										</button>
										<button
											class="btn btn-sm btn-write"
											disabled={Boolean(busy) || !plannedCascade?.startsWith(`${target.id}@`)}
											onclick={() => cascade(target.id, true)}
											title={plannedCascade?.startsWith(`${target.id}@`)
												? `Write pins and lockfiles for ${plannedCascade}. Commits by default.`
												: 'Run Plan cascade first.'}
										>
											{plannedCascade?.startsWith(`${target.id}@`)
												? `Write ${plannedCascade.slice(target.id.length + 1)}`
												: 'Write pins'}
										</button>
									</div>
								</li>
							{/each}
						</ul>
					{/if}
				</section>

				<section class="panel">
					<div class="section-head">
						<div>
							<h2>FilePress sites</h2>
							<p class="hint">
								Content sites, not npm packages — a name can match a fleet row (for example localberth) and still be a different thing.
							</p>
						</div>
						<button type="button" class="btn btn-sm" onclick={() => setTab('sites')}>Open Sites</button>
					</div>
					{#if !filepressBoard}
						<p class="dim small">No FilePress plugin loaded. Enroll the filepress checkout to see sites here.</p>
					{:else}
						<p class="dim small">
							{filepressBoard.rows.length} sites
							{#if sitesNeedingYou.length}
								· {sitesNeedingYou.length} need a sync, header merge, or have a dirty git tree
							{:else}
								· none waiting on an engine sync
							{/if}
						</p>
						<div class="group-buttons">
							<button
								class="btn"
								disabled={Boolean(busy) || filepressSyncIds.length === 0}
								onclick={() => runPluginJob(filepressBoard.plugin, 'sync', filepressSyncIds, false)}
								title="Plan engine sync for every listed FilePress site. Writes nothing."
							>
								Plan engine sync
							</button>
							<button
								class="btn btn-write"
								disabled={Boolean(busy) || !pluginJobWriteReady(filepressBoard.plugin, 'sync', filepressSyncIds)}
								onclick={() => requestPluginJob(filepressBoard.plugin, 'sync', plannedPluginWrites, 'Sync engine')}
								title={pluginJobWriteReady(filepressBoard.plugin, 'sync', filepressSyncIds)
									? `Sync getfilepress + headers on ${plannedPluginWrites.length} site(s).`
									: pluginJobPlanned(filepressBoard.plugin, 'sync', filepressSyncIds)
										? 'Plan found nothing to write — every listed site is already current.'
										: 'Run Plan engine sync first.'}
							>
								{syncAllLabel(filepressBoard.plugin, filepressSyncIds)}
							</button>
						</div>
						{#if sitesNeedingYou.length}
							<ul class="need-list compact">
								{#each sitesNeedingYou.slice(0, 8) as site (site.id)}
									<li class="need-card">
										<div class="id">{site.id}</div>
										{#if enrolledIds.has(site.id)}
											<div class="dim small">FilePress site — not the fleet package</div>
										{/if}
										<div class="dim small">{site.cells.update ?? '—'}</div>
									</li>
								{/each}
							</ul>
							{#if sitesNeedingYou.length > 8}
								<p class="dim small">{sitesNeedingYou.length - 8} more on the Sites tab.</p>
							{/if}
						{/if}
					{/if}
				</section>
			</div>
		{:else if tab === 'fleet'}
			<div class="fleet-layout">
				<section class="panel">
					<div class="section-head">
						<div>
							<h2>Fleet</h2>
							<p class="hint">Check rows to remove them from the fleet. Removing never deletes a folder. Version bump only writes package.json — publish lives on Today.</p>
						</div>
						<div class="group-buttons">
							<button class="btn" disabled={Boolean(busy) || !checkedIds.length} onclick={() => unenroll(false)}>
								Plan remove{checkedIds.length ? ` (${checkedIds.length})` : ''}
							</button>
							<button
								class="btn btn-write"
								disabled={Boolean(busy) || !plannedUnenroll || plannedUnenroll !== [...checkedIds].sort().join('|')}
								onclick={() => unenroll(true)}
								title={plannedUnenroll ? 'Rewrite localhelm.fleet.json without these rows.' : 'Run Plan remove first.'}
							>
								Remove from fleet
							</button>
						</div>
					</div>

					<div class="table-wrap">
						<table>
							<thead>
								<tr>
									<th class="tick"></th>
									<th>project</th>
									<th>local</th>
									<th>on npm</th>
									<th>git</th>
									<th>fleet pins</th>
									<th>needs you</th>
									<th>version bump</th>
								</tr>
							</thead>
							<tbody>
								{#each inventory?.projects ?? [] as row (row.id)}
									<tr>
										<td class="tick"><input type="checkbox" aria-label={`select ${row.id}`} bind:checked={selectedIds[row.id]} /></td>
										<td>
											<div class="id">{row.id}</div>
											<div class="dim small">{row.npm.name ?? row.path}</div>
										</td>
										<td class="mono">{row.localVersion ?? '—'}</td>
										<td class="mono" class:ahead={row.unpublishedAhead}>{npmLabel(row)}</td>
										<td class="small">{gitSummary(row)}</td>
										<td>
											{#if row.pins.length}
												<div class="pins">
													{#each row.pins as pin (pin.fromFile + pin.name)}
														<span class={`pin ${pinTone(pin)}`} title={`${pin.fromFile} package.json · ${pin.spec}${pin.note ? ` · ${pin.note}` : ''}`}>
															{pinLabel(pin)}
														</span>
													{/each}
												</div>
											{:else}
												<span class="dim">—</span>
											{/if}
										</td>
										<td>
											<div class="badges">
												{#each badges(row) as badge (badge.text)}
													<span class={`badge ${badge.tone}`} title={badge.title ?? ''}>{badge.text}</span>
												{/each}
											</div>
										</td>
										<td>
											<div class="bump">
												<select aria-label={`bump kind for ${row.id}`} bind:value={bumpKind[row.id]}>
													<option value="patch">patch</option>
													<option value="minor">minor</option>
													<option value="major">major</option>
												</select>
												<button class="btn btn-sm" disabled={Boolean(busy)} onclick={() => bump(row.id, false)} title="Show the next version. Writes nothing.">
													Plan
												</button>
												<button
													class="btn btn-sm btn-write"
													disabled={Boolean(busy) || !plannedTarget(row.id)}
													onclick={() => bump(row.id, true)}
													title={plannedTarget(row.id)
														? `Write version ${plannedTarget(row.id)} to package.json. No tag, no publish.`
														: 'Run Plan first for this bump size.'}
												>
													{plannedTarget(row.id) ? `Write ${plannedTarget(row.id)}` : 'Write'}
												</button>
											</div>
										</td>
									</tr>
								{/each}
								{#if !inventory?.projects.length}
									<tr><td class="empty" colspan="8">Nothing enrolled yet. Scan a folder, tick the projects you ship, then enroll.</td></tr>
								{/if}
							</tbody>
						</table>
					</div>

					<p class="legend">
						<strong>Plan</strong> buttons only print what would happen. <strong>Write</strong> buttons change files on disk, one job at a time.
						Publish is a named plan on Today: bump and push only if needed, then <code>npm publish</code>. Never <code>--force</code>. Never the IngotVault backup remote.
					</p>
				</section>

				<section class="panel">
					<h2>Add projects</h2>
					<p class="hint">Scanning proposes folders. Nothing joins the fleet until you tick it and write.</p>
					<label for="scan-root">Folder to scan</label>
					<div class="row">
						<input id="scan-root" bind:value={scanRoot} spellcheck="false" />
						<button class="btn" disabled={Boolean(busy)} onclick={() => scan()}>Scan</button>
					</div>

					{#if candidates.length}
						<p class="hint">
							{candidates.filter((c) => !enrolledIds.has(c.id)).length} new ·
							{candidates.filter((c) => enrolledIds.has(c.id)).length} already enrolled
						</p>
						<ul class="candidates">
							{#each candidates as row (row.absPath)}
								{@const already = enrolledIds.has(row.id)}
								<li class:already>
									<input
										type="checkbox"
										aria-label={`enroll ${row.id}`}
										disabled={already}
										bind:checked={selectedScan[row.absPath]}
										onchange={() => (plannedEnroll = null)}
									/>
									<div>
										<div class="id">{row.id}</div>
										<div class="dim small">
											{row.npmName ?? 'no package name'}{row.version ? ` ${row.version}` : ''}{row.git ? ' · git' : ' · no git'}{already
												? ' · enrolled'
												: ''}
										</div>
									</div>
								</li>
							{/each}
						</ul>
						<div class="group-buttons">
							<button class="btn" disabled={Boolean(busy) || !checkedScan.length} onclick={() => enroll(false)}>
								Plan enroll{checkedScan.length ? ` (${checkedScan.length})` : ''}
							</button>
							<button
								class="btn btn-write"
								disabled={Boolean(busy) || !plannedEnroll || plannedEnroll !== [...checkedScan].sort().join('|')}
								onclick={() => enroll(true)}
								title={plannedEnroll ? 'Write these rows into localhelm.fleet.json.' : 'Run Plan enroll first.'}
							>
								Add to fleet
							</button>
						</div>
					{/if}
				</section>
			</div>
		{:else}
			{#each pluginBoards as board (board.plugin)}
				<section class="panel plugin-board">
					<div class="section-head">
						<div>
							<h2>{board.title}</h2>
							<p class="hint">
								{board.note}
								{#if board.plugin === 'filepress'}
									Site names can match a fleet package and still be a different checkout.
								{/if}
							</p>
						</div>
						{#if board.plugin === 'filepress'}
							<div class="group-buttons">
								<button
									class="btn"
									disabled={Boolean(busy) || filepressSyncIds.length === 0}
									onclick={() => runPluginJob(board.plugin, 'sync', filepressSyncIds, false)}
									title="Plan engine sync for every listed FilePress site. Writes nothing."
								>
									Plan engine sync
								</button>
								<button
									class="btn btn-write"
									disabled={Boolean(busy) || !pluginJobWriteReady(board.plugin, 'sync', filepressSyncIds)}
									onclick={() => requestPluginJob(board.plugin, 'sync', plannedPluginWrites, 'Sync engine')}
									title={pluginJobWriteReady(board.plugin, 'sync', filepressSyncIds)
										? `Sync getfilepress + headers on ${plannedPluginWrites.length} site(s).`
										: pluginJobPlanned(board.plugin, 'sync', filepressSyncIds)
											? 'Plan found nothing to write — every listed site is already current.'
											: 'Run Plan engine sync first.'}
								>
									{syncAllLabel(board.plugin, filepressSyncIds)}
								</button>
							</div>
						{/if}
					</div>
					<div class="table-wrap">
						<table>
							<thead>
								<tr>
									<th>site</th>
									{#each board.columns as col (col.id)}
										<th>{col.label}</th>
									{/each}
									<th>plugin jobs</th>
								</tr>
							</thead>
							<tbody>
								{#each board.rows as row (row.id)}
									<tr>
										<td class="id">
											{row.id}
											{#if enrolledIds.has(row.id)}
												<div class="dim small">FilePress site — not the fleet package</div>
											{/if}
										</td>
										{#each board.columns as col (col.id)}
											<td class="small">{row.cells[col.id] ?? '—'}</td>
										{/each}
										<td>
											<div class="bump">
												{#each row.actions as act (act.id)}
													<button
														class="btn btn-sm"
														disabled={Boolean(busy)}
														onclick={() => runPluginJob(board.plugin, act.id, [row.id], false)}
													>
														Plan {act.label.toLowerCase()}
													</button>
													<button
														class="btn btn-sm btn-write"
														disabled={Boolean(busy) || !pluginRowWriteReady(board.plugin, act.id, row.id)}
														onclick={() => requestPluginJob(board.plugin, act.id, [row.id], act.label)}
														title={pluginRowWriteReady(board.plugin, act.id, row.id)
															? `Run ${act.label} via the ${board.title} plugin.`
															: plannedPlugin === pluginKey(board.plugin, act.id, [row.id])
																? 'Already current — nothing to write.'
																: 'Run the matching Plan first.'}
													>
														{plannedPlugin === pluginKey(board.plugin, act.id, [row.id]) && !plannedPluginWrites.includes(row.id)
															? 'Already current'
															: act.label}
													</button>
												{/each}
											</div>
										</td>
									</tr>
								{/each}
								{#if !board.rows.length}
									<tr><td class="empty" colspan={board.columns.length + 2}>No rows from this plugin.</td></tr>
								{/if}
							</tbody>
						</table>
					</div>
				</section>
			{:else}
				<section class="panel">
					<h2>Sites</h2>
					<p class="hint">No plugins loaded. An enrolled project can expose <code>localhelm.plugin.mjs</code>.</p>
				</section>
			{/each}
		{/if}

		<section class="panel activity-dock">
			<div class="section-head">
				<div>
					<h2>Activity</h2>
					<p class="hint">Every plan and write, newest first — the same output the CLI prints.</p>
				</div>
				{#if entries.length}
					<button class="btn btn-sm" onclick={() => (entries = [])}>Clear</button>
				{/if}
			</div>
			{#if entries.length === 0}
				<p class="dim small">Nothing yet.</p>
			{:else}
				<ul class="log">
					{#each entries as entry (entry.time + entry.title)}
						<li>
							<details>
								<summary><span class="dim small">{entry.time}</span> {entry.title}</summary>
								<pre>{entry.body}</pre>
							</details>
						</li>
					{/each}
				</ul>
			{/if}
		</section>
	</main>
</div>

<ConfirmModal
	bind:open={confirmOpen}
	title={confirmTitle}
	hint={confirmHint}
	confirmLabel={confirmLabel}
	variant={confirmVariant}
	busy={Boolean(busy)}
	items={confirmItems}
	onconfirm={() => {
		confirmRun?.();
	}}
/>

<style>
	.shell {
		min-height: 100vh;
		background: #1c1c21;
		color: #ececef;
		font-family:
			ui-sans-serif,
			system-ui,
			sans-serif;
	}

	header {
		background: #000;
		border-bottom: 1px solid #1f1f22;
		padding: 1.1rem 1.5rem;
	}

	.head-row {
		display: flex;
		flex-wrap: wrap;
		justify-content: space-between;
		align-items: flex-start;
		gap: 1.25rem;
	}

	.brand {
		display: flex;
		align-items: center;
		gap: 0.85rem;
	}

	.mark {
		width: 6rem;
		height: auto;
		flex-shrink: 0;
	}

	.eyebrow {
		font-size: 0.68rem;
		letter-spacing: 0.2em;
		text-transform: uppercase;
		color: #9b9ba3;
	}

	h1 {
		font-size: 1.45rem;
		font-weight: 600;
		margin: 0.15rem 0;
	}

	h2 {
		font-size: 1.02rem;
		font-weight: 600;
		margin: 0;
	}

	.sub {
		font-size: 0.82rem;
		color: #c4c4cc;
	}

	.hint {
		font-size: 0.75rem;
		color: #a8a8b0;
		margin: 0.2rem 0 0.5rem;
	}

	.dim {
		color: #8b8b93;
	}

	.small {
		font-size: 0.75rem;
	}

	.mono,
	code,
	pre {
		font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
	}

	.actions {
		display: flex;
		flex-wrap: wrap;
		gap: 1rem;
	}

	.group {
		border: 1px solid #4a4a52;
		background: #323238;
		border-radius: 0.6rem;
		padding: 0.45rem 0.6rem 0.55rem;
	}

	.group-write {
		border-color: #8a6d1f;
		background: #3d3420;
	}

	.group-label {
		display: block;
		font-size: 0.66rem;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: #b4b4bc;
		margin-bottom: 0.35rem;
	}

	.group-buttons {
		display: flex;
		flex-wrap: wrap;
		gap: 0.4rem;
		align-items: center;
	}

	.btn {
		border: 1px solid #5a5a64;
		background: #3c3c44;
		color: #ececef;
		border-radius: 0.4rem;
		padding: 0.28rem 0.62rem;
		font-size: 0.8rem;
		cursor: pointer;
	}

	.btn:hover:not(:disabled) {
		border-color: #8b8b93;
		background: #484850;
	}

	.btn-write {
		border-color: #c9a227;
		background: #4a3a12;
		color: #fde68a;
	}

	.btn-sm {
		padding: 0.18rem 0.45rem;
		font-size: 0.72rem;
	}

	.btn:disabled {
		opacity: 0.42;
		cursor: not-allowed;
	}

	.chips {
		display: flex;
		flex-wrap: wrap;
		gap: 0.4rem;
		margin-top: 0.9rem;
	}

	.chip {
		border: 1px solid #4c4c54;
		background: #333338;
		border-radius: 999px;
		padding: 0.12rem 0.6rem;
		font-size: 0.72rem;
		color: #c4c4cc;
		font: inherit;
		cursor: pointer;
	}

	button.chip {
		font-size: 0.72rem;
	}

	.chip.hot {
		border-color: #c9a227;
		color: #fcd34d;
	}

	.chip.warm {
		border-color: #8a8a2a;
		color: #e4e48a;
	}

	.chip.bad {
		border-color: #b45454;
		color: #fca5a5;
	}

	.chip.quiet {
		border-style: dashed;
		cursor: default;
	}

	.line {
		margin-top: 0.7rem;
		font-size: 0.8rem;
	}

	.busy {
		color: #fcd34d;
	}

	.err {
		color: #f87171;
	}

	.info {
		color: #93c5fd;
	}

	.tabs {
		display: flex;
		flex-wrap: wrap;
		gap: 0.35rem;
		padding: 0.85rem 1.5rem 0;
		background: #000;
		border-bottom: 1px solid #1f1f22;
	}

	.tab {
		border: 1px solid transparent;
		background: transparent;
		color: #a8a8b0;
		padding: 0.5rem 0.95rem;
		border-radius: 0.55rem 0.55rem 0 0;
		font-size: 0.88rem;
		cursor: pointer;
		display: inline-flex;
		align-items: center;
		gap: 0.4rem;
	}

	.tab:hover {
		color: #ececef;
		background: #2c2c32;
	}

	.tab.active {
		background: #333338;
		color: #f4f4f5;
		border-color: #4c4c54;
		border-bottom-color: #333338;
		margin-bottom: -1px;
	}

	.tab.hot .count {
		color: #fcd34d;
	}

	.tab .count {
		font-size: 0.7rem;
		border: 1px solid #5a5a64;
		border-radius: 999px;
		padding: 0 0.4rem;
		color: #d4d4dc;
	}

	.tab .count.quiet {
		color: #a8a8b0;
	}

	main {
		display: flex;
		flex-direction: column;
		gap: 1rem;
		padding: 1.1rem 1.5rem 2.5rem;
	}

	.today-grid,
	.fleet-layout {
		display: grid;
		gap: 1rem;
	}

	@media (min-width: 1100px) {
		.today-grid {
			grid-template-columns: minmax(0, 1.35fr) minmax(20rem, 0.85fr);
			align-items: start;
		}

		.fleet-layout {
			grid-template-columns: minmax(0, 1fr) 22rem;
			align-items: start;
		}
	}

	.section-head {
		display: flex;
		flex-wrap: wrap;
		align-items: flex-end;
		justify-content: space-between;
		gap: 0.6rem;
		margin-bottom: 0.6rem;
	}

	.plugin-board {
		margin-top: 0;
	}

	.table-wrap {
		overflow-x: auto;
		border: 1px solid #4c4c54;
		background: #2c2c32;
		border-radius: 0.6rem;
	}

	table {
		width: 100%;
		border-collapse: collapse;
		font-size: 0.84rem;
	}

	thead {
		background: #3a3a42;
		color: #c4c4cc;
	}

	th {
		text-align: left;
		font-weight: 400;
		font-size: 0.72rem;
		letter-spacing: 0.04em;
		text-transform: uppercase;
		padding: 0.5rem 0.7rem;
	}

	td {
		padding: 0.55rem 0.7rem;
		border-top: 1px solid #44444c;
		vertical-align: top;
	}

	.tick {
		width: 1.8rem;
	}

	.id {
		font-weight: 600;
	}

	.ahead {
		color: #fcd34d;
	}

	.empty {
		color: #8b8b93;
		padding: 1.4rem 0.7rem;
	}

	.badges,
	.pins {
		display: flex;
		flex-wrap: wrap;
		gap: 0.25rem;
		max-width: 22rem;
	}

	.badge,
	.pin {
		border: 1px solid #5a5a64;
		border-radius: 0.35rem;
		padding: 0.05rem 0.35rem;
		font-size: 0.7rem;
		white-space: nowrap;
		background: #2a2a30;
	}

	.badge.ship {
		border-color: #c9a227;
		background: #4a3a12;
		color: #fde68a;
	}

	.badge.warn {
		border-color: #8a8a2a;
		color: #e4e48a;
		background: #3a3a16;
	}

	.badge.bad {
		border-color: #b45454;
		color: #fca5a5;
		background: #3a1c1c;
	}

	.badge.info {
		color: #c4c4cc;
	}

	.pin-ok {
		border-color: #2d6a45;
		color: #86efac;
	}

	.pin-behind {
		border-color: #c9a227;
		color: #fcd34d;
	}

	.pin-local {
		border-color: #3b6ea8;
		color: #93c5fd;
	}

	.legend {
		margin-top: 0.7rem;
		font-size: 0.74rem;
		color: #a8a8b0;
	}

	.panel {
		border: 1px solid #4c4c54;
		background: #333338;
		border-radius: 0.7rem;
		padding: 0.95rem 1rem;
		box-shadow: 0 1px 0 rgba(255, 255, 255, 0.04);
	}

	.quiet-banner {
		background: #2f3d32;
		border: 1px solid #3f6b4a;
		color: #b8e0c2;
		padding: 0.8rem 1rem;
		border-radius: 0.55rem;
		margin: 0.4rem 0 0;
		font-size: 0.84rem;
	}

	.need-list {
		list-style: none;
		margin: 0.65rem 0 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 0.55rem;
	}

	.need-list.compact {
		max-height: 18rem;
		overflow: auto;
	}

	.need-card {
		background: #3d3d46;
		border: 1px solid #585860;
		border-radius: 0.55rem;
		padding: 0.7rem 0.8rem;
	}

	.need-head {
		display: flex;
		flex-wrap: wrap;
		justify-content: space-between;
		gap: 0.5rem;
		margin-bottom: 0.45rem;
	}

	.cascade-note {
		margin: 0.35rem 0 0.25rem;
	}

	.activity-dock .log {
		max-height: 14rem;
	}

	label {
		display: block;
		font-size: 0.7rem;
		color: #a8a8b0;
		margin-bottom: 0.25rem;
	}

	.row {
		display: flex;
		gap: 0.4rem;
	}

	input:not([type]) {
		flex: 1;
		min-width: 0;
		border: 1px solid #5a5a64;
		background: #3c3c44;
		color: #ececef;
		border-radius: 0.4rem;
		padding: 0.25rem 0.5rem;
		font-size: 0.8rem;
	}

	select {
		border: 1px solid #5a5a64;
		background: #3c3c44;
		color: #ececef;
		border-radius: 0.35rem;
		font-size: 0.72rem;
		padding: 0.15rem 0.2rem;
	}

	.bump {
		display: flex;
		flex-wrap: wrap;
		gap: 0.25rem;
		align-items: center;
	}

	.candidates,
	.log {
		list-style: none;
		margin: 0.5rem 0;
		padding: 0;
		max-height: 20rem;
		overflow: auto;
		display: flex;
		flex-direction: column;
		gap: 0.3rem;
	}

	.grow {
		flex: 1;
		min-width: 0;
	}

	.candidates li {
		display: flex;
		gap: 0.5rem;
		align-items: flex-start;
		border: 1px solid #4c4c54;
		background: #3d3d46;
		border-radius: 0.4rem;
		padding: 0.3rem 0.45rem;
	}

	.candidates li.already {
		opacity: 0.55;
	}

	.log li {
		border: 1px solid #4c4c54;
		background: #2c2c32;
		border-radius: 0.4rem;
		padding: 0.3rem 0.45rem;
		font-size: 0.76rem;
	}

	summary {
		cursor: pointer;
	}

	pre {
		margin: 0.4rem 0 0;
		max-height: 14rem;
		overflow: auto;
		white-space: pre-wrap;
		font-size: 0.68rem;
		color: #c4c4cc;
	}
</style>
