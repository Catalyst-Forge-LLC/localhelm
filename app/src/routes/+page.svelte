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
	let activityOpen = $state(false);
	let activityUnseen = $state(false);
	let cwd = $state('');
	let port = $state<string | null>(null);
	let portSource = $state<string | null>(null);
	let fetchedAt = $state<string | null>(null);

	let scanRoot = $state('..');
	let candidates = $state<Candidate[]>([]);
	let selectedScan = $state<Record<string, boolean>>({});
	let selectedIds = $state<Record<string, boolean>>({});
	let selectedSites = $state<Record<string, boolean>>({});
	let bumpKind = $state<Record<string, BumpKind>>({});

	let pluginBoards = $state<PluginBoard[]>([]);
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
	let confirmCanApply = $state(true);
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
	const filepressPushIds = $derived(
		(filepressBoard?.rows ?? [])
			.filter((row) => row.actions.some((act) => act.id === 'push'))
			.map((row) => row.id),
	);
	const fleetIds = $derived((inventory?.projects ?? []).map((row) => row.id));
	const fleetAllChecked = $derived(fleetIds.length > 0 && fleetIds.every((id) => selectedIds[id]));
	const fleetSomeChecked = $derived(checkedIds.length > 0 && !fleetAllChecked);

	function persist(key: string, value: string): void {
		try {
			sessionStorage.setItem(key, value);
		} catch {
			/* ignore quota / private mode */
		}
	}

	function setTab(next: TabId): void {
		tab = next;
		persist('localhelm.tab', next);
	}

	function setActivityOpen(next: boolean): void {
		activityOpen = next;
		if (next) activityUnseen = false;
		persist('localhelm.activity', next ? '1' : '0');
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
		if (!activityOpen) activityUnseen = true;
	}

	async function run(label: string, fn: () => Promise<void>, opts?: { closeConfirm?: boolean }): Promise<void> {
		busy = label;
		error = '';
		try {
			await fn();
		} catch (err) {
			error = err instanceof Error ? err.message : String(err);
		} finally {
			busy = '';
			if (opts?.closeConfirm !== false) {
				confirmOpen = false;
				confirmRun = null;
			}
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
			note(`scan ${scanRoot} — ${data.candidates.length} candidate(s), nothing written`, data);
		});
	}

	function offerConfirm(spec: {
		title: string;
		hint: string;
		items: string[];
		confirmLabel: string;
		variant?: 'write' | 'danger';
		canApply: boolean;
		run?: () => void;
	}): void {
		confirmTitle = spec.title;
		confirmHint = spec.hint;
		confirmItems = spec.items;
		confirmLabel = spec.confirmLabel;
		confirmVariant = spec.variant ?? 'write';
		confirmCanApply = spec.canApply;
		confirmRun = spec.canApply && spec.run ? spec.run : null;
		confirmOpen = true;
	}

	function rowLines(data: unknown): string[] {
		if (!data || typeof data !== 'object') return [];
		const rows = (data as { rows?: unknown }).rows;
		if (!Array.isArray(rows)) return [];
		return rows
			.filter((row): row is Record<string, unknown> => Boolean(row) && typeof row === 'object')
			.map((row) => {
				const id =
					typeof row.id === 'string'
						? row.id
						: typeof row.fromId === 'string'
							? row.fromId
							: typeof row.path === 'string'
								? row.path
								: '?';
				const action = typeof row.action === 'string' ? row.action : '';
				const reason = typeof row.reason === 'string' ? row.reason : typeof row.update === 'string' ? row.update : '';
				const from = typeof row.from === 'string' ? row.from : typeof row.fromSpec === 'string' ? row.fromSpec : '';
				const to = typeof row.to === 'string' ? row.to : typeof row.toSpec === 'string' ? row.toSpec : '';
				const range = from && to ? `${from} → ${to}` : from || to;
				return [id, action, range, reason].filter(Boolean).join('  ');
			});
	}

	async function startEnroll(): Promise<void> {
		if (!checkedScan.length) {
			error = 'Check at least one scanned folder first.';
			return;
		}
		const paths = [...checkedScan];
		await run(
			'planning enroll',
			async () => {
				const plan = await call('/api/enroll', {
					method: 'POST',
					body: JSON.stringify({ paths, apply: false }),
				});
				const adds = Array.isArray((plan as { rows?: { action?: string }[] }).rows)
					? (plan as { rows: { action?: string }[] }).rows.filter((row) => row.action === 'add')
					: [];
				note(`enroll plan — ${paths.length} project(s), nothing written`, plan);
				offerConfirm({
					title: adds.length ? `Add ${adds.length} project${adds.length === 1 ? '' : 's'} to the fleet?` : 'Nothing to enroll',
					hint: adds.length
						? 'Writes these rows into localhelm.fleet.json. Does not copy or delete folders.'
						: 'Every ticked folder is already enrolled or cannot be added.',
					items: rowLines(plan).length ? rowLines(plan) : ['Nothing to enroll.'],
					confirmLabel: adds.length === 1 ? 'Add to fleet' : `Add ${adds.length} to fleet`,
					canApply: adds.length > 0,
					run: () => void applyEnroll(paths),
				});
			},
			{ closeConfirm: false },
		);
	}

	async function applyEnroll(paths: string[]): Promise<void> {
		await run('enrolling', async () => {
			const plan = await call('/api/enroll', {
				method: 'POST',
				body: JSON.stringify({ paths, apply: true }),
			});
			note(`enrolled ${paths.length} project(s)`, plan);
			selectedScan = {};
			await refresh();
		});
	}

	async function startUnenroll(): Promise<void> {
		if (!checkedIds.length) {
			error = 'Check at least one fleet row first.';
			return;
		}
		const ids = [...checkedIds];
		await run(
			'planning unenroll',
			async () => {
				const plan = await call('/api/unenroll', {
					method: 'POST',
					body: JSON.stringify({ ids, apply: false }),
				});
				const removes = Array.isArray((plan as { rows?: { action?: string }[] }).rows)
					? (plan as { rows: { action?: string }[] }).rows.filter((row) => row.action === 'update')
					: [];
				note(`unenroll plan — ${ids.length} row(s), nothing written`, plan);
				offerConfirm({
					title: removes.length ? `Remove ${removes.length} project${removes.length === 1 ? '' : 's'} from the fleet?` : 'Nothing to remove',
					hint: removes.length
						? 'Rewrites localhelm.fleet.json without these rows. Never deletes a folder.'
						: 'None of the ticked rows are enrolled.',
					items: rowLines(plan).length ? rowLines(plan) : ['Nothing to remove.'],
					confirmLabel: removes.length === 1 ? 'Remove from fleet' : `Remove ${removes.length} from fleet`,
					variant: 'danger',
					canApply: removes.length > 0,
					run: () => void applyUnenroll(ids),
				});
			},
			{ closeConfirm: false },
		);
	}

	async function applyUnenroll(ids: string[]): Promise<void> {
		await run('removing from fleet', async () => {
			const plan = await call('/api/unenroll', {
				method: 'POST',
				body: JSON.stringify({ ids, apply: true }),
			});
			note(`removed ${ids.length} project(s) from the fleet`, plan);
			selectedIds = {};
			await refresh();
		});
	}

	async function startBump(ids: string[]): Promise<void> {
		if (ids.length === 0) {
			error = 'Check at least one fleet row first.';
			return;
		}
		const jobs = ids.map((id) => ({ id, kind: (bumpKind[id] ?? 'patch') as BumpKind }));
		const scope = jobs.length === 1 ? jobs[0]?.id : `${jobs.length} projects`;
		await run(
			`planning bump for ${scope}`,
			async () => {
				const plans: BumpPlan[] = [];
				for (const job of jobs) {
					const plan = (await call('/api/bump', {
						method: 'POST',
						body: JSON.stringify({ id: job.id, kind: job.kind, apply: false }),
					})) as BumpPlan;
					plans.push(plan);
					note(
						plan.action === 'bump'
							? `bump plan ${job.id} ${plan.from} → ${plan.to}, nothing written`
							: `bump plan ${job.id} — skipped`,
						plan,
					);
				}
				const can = plans.filter((plan) => plan.action === 'bump' && Boolean(plan.to));
				offerConfirm({
					title: can.length === 1
						? `Bump ${can[0]?.id} to ${can[0]?.to}?`
						: can.length
							? `Bump ${can.length} projects?`
							: 'Nothing to bump',
					hint: can.length
						? 'Writes package.json only. No tag, no publish. Each row uses its own patch/minor/major.'
						: plans[0]?.reason ?? 'cannot bump',
					items: plans.map((plan) =>
						plan.action === 'bump' && plan.to
							? `${plan.id}  ${plan.from ?? '?'} → ${plan.to}`
							: `${plan.id}  ${plan.reason ?? 'skipped'}`,
					),
					confirmLabel: can.length === 1 ? `Write ${can[0]?.to}` : `Write ${can.length}`,
					canApply: can.length > 0,
					run: () =>
						void applyBumps(
							can.map((plan) => ({
								id: plan.id,
								kind: jobs.find((job) => job.id === plan.id)?.kind ?? 'patch',
							})),
						),
				});
			},
			{ closeConfirm: false },
		);
	}

	async function applyBumps(jobs: { id: string; kind: BumpKind }[]): Promise<void> {
		const scope = jobs.length === 1 ? jobs[0]?.id : `${jobs.length} projects`;
		await run(`bumping ${scope}`, async () => {
			for (const job of jobs) {
				const plan = (await call('/api/bump', {
					method: 'POST',
					body: JSON.stringify({ id: job.id, kind: job.kind, apply: true }),
				})) as BumpPlan;
				note(`bumped ${job.id} to ${plan.to}`, plan);
			}
			await refresh();
		});
	}

	function toggleFleetAll(on: boolean): void {
		const next = { ...selectedIds };
		for (const id of fleetIds) next[id] = on;
		selectedIds = next;
	}

	function boardActions(board: PluginBoard): { id: string; label: string }[] {
		const seen = new Map<string, { id: string; label: string }>();
		for (const row of board.rows) {
			for (const act of row.actions) {
				if (!seen.has(act.id)) seen.set(act.id, { id: act.id, label: act.label });
			}
		}
		return [...seen.values()];
	}

	function boardActionIds(board: PluginBoard, action: string): string[] {
		return board.rows.filter((row) => row.actions.some((act) => act.id === action)).map((row) => row.id);
	}

	function checkedSiteIds(board: PluginBoard, action: string): string[] {
		return boardActionIds(board, action).filter((id) => selectedSites[id]);
	}

	function siteAllChecked(board: PluginBoard): boolean {
		return board.rows.length > 0 && board.rows.every((row) => selectedSites[row.id]);
	}

	function toggleSiteAll(board: PluginBoard, on: boolean): void {
		const next = { ...selectedSites };
		for (const row of board.rows) next[row.id] = on;
		selectedSites = next;
	}

	async function fetchOrigins(): Promise<void> {
		await run('git fetch origin in every repo', async () => {
			const data = (await call('/api/fetch', { method: 'POST' })) as { rows: GitRow[] };
			const failed = data.rows.filter((r) => r.action === 'fetch' && r.reason !== 'fetched');
			note(`fetch — ${data.rows.filter((r) => r.reason === 'fetched').length} fetched, ${failed.length} failed`, data);
			await refresh();
		});
	}

	async function startPull(): Promise<void> {
		await run(
			'planning pull',
			async () => {
				const data = (await call('/api/pull', { method: 'POST', body: JSON.stringify({ apply: false }) })) as {
					rows: GitRow[];
				};
				const eligible = data.rows.filter((r) => r.action === 'pull');
				note(`pull plan — ${eligible.length} of ${data.rows.length} eligible, nothing written`, data);
				offerConfirm({
					title: eligible.length ? `Pull ${eligible.length} repo${eligible.length === 1 ? '' : 's'}?` : 'Nothing to pull',
					hint: eligible.length
						? 'git pull --ff-only on the listed repos. Dirty or diverged trees are skipped.'
						: 'Nothing is eligible: repos must be clean and behind.',
					items: eligible.length ? eligible.map((row) => `${row.id}  ${row.branch ?? '?'}  ${row.reason ?? 'pull'}`) : ['Nothing to pull.'],
					confirmLabel: eligible.length === 1 ? `Pull ${eligible[0]?.id}` : `Pull ${eligible.length} repos`,
					canApply: eligible.length > 0,
					run: () => void applyPull(),
				});
			},
			{ closeConfirm: false },
		);
	}

	async function applyPull(): Promise<void> {
		await run('pulling (fast-forward only)', async () => {
			const data = (await call('/api/pull', { method: 'POST', body: JSON.stringify({ apply: true }) })) as {
				rows: GitRow[];
			};
			const eligible = data.rows.filter((r) => r.action === 'pull');
			note(`pull --apply — ${eligible.length} repo(s) fast-forwarded`, data);
			await refresh();
		});
	}

	function pushItems(rows: GitRow[]): string[] {
		return rows.map((row) => {
			const n = row.ahead ?? '?';
			return `${row.id}  ${row.branch ?? '?'}  ${n} commit(s)  →  ${row.origin ?? ''}`;
		});
	}

	async function startPush(onlyIds?: string[]): Promise<void> {
		const scope = onlyIds?.length === 1 ? onlyIds[0] : onlyIds?.length ? `${onlyIds.length} repos` : 'all';
		await run(
			`planning push ${scope}`,
			async () => {
				const data = (await call('/api/push', {
					method: 'POST',
					body: JSON.stringify({ apply: false, ids: onlyIds }),
				})) as { rows: GitRow[] };
				const eligible = data.rows.filter((r) => r.action === 'push');
				note(`push plan — ${eligible.length} of ${data.rows.length} eligible (origin only), nothing written`, data);
				offerConfirm({
					title: eligible.length === 1 ? `Push ${eligible[0]?.id} to origin?` : eligible.length ? 'Push these branches to origin?' : 'Nothing to push',
					hint: eligible.length
						? 'git push origin only. Never --force. Never the IngotVault backup remote.'
						: onlyIds?.length === 1
							? `${onlyIds[0]}: ${data.rows[0]?.reason ?? 'cannot push'}`
							: 'Nothing is eligible: repos must be clean, ahead, and not diverged.',
					items: eligible.length ? pushItems(eligible) : ['Nothing to push.'],
					confirmLabel: eligible.length === 1 ? `Push ${eligible[0]?.id}` : `Push ${eligible.length} to origin`,
					canApply: eligible.length > 0,
					run: () => void applyPush(eligible.map((row) => row.id)),
				});
			},
			{ closeConfirm: false },
		);
	}

	async function applyPush(ids: string[]): Promise<void> {
		const scope = ids.length === 1 ? ids[0] : `${ids.length} repos`;
		await run(`pushing ${scope}`, async () => {
			const data = (await call('/api/push', { method: 'POST', body: JSON.stringify({ apply: true, ids }) })) as {
				rows: GitRow[];
			};
			const eligible = data.rows.filter((r) => r.action === 'push');
			const failed = eligible.filter((r) => r.reason !== 'pushed');
			note(
				`push --apply — ${eligible.filter((r) => r.reason === 'pushed').length} pushed, ${failed.length} failed`,
				data,
			);
			await refresh();
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

	async function startPublish(ids: string[]): Promise<void> {
		if (ids.length === 0) return;
		const label = ids.length === 1 ? ids[0] : `${ids.length} packages`;
		await run(
			`planning publish ${label}`,
			async () => {
				const data = (await call('/api/publish', {
					method: 'POST',
					body: JSON.stringify({
						apply: false,
						ids,
						kind: ids.length === 1 ? (bumpKind[ids[0] ?? ''] ?? 'patch') : 'patch',
					}),
				})) as { rows: PublishRow[]; npmUser?: string | null; authHint?: string };
				if (data.authHint) publishAuthHint = data.authHint;
				npmUser = data.npmUser ?? null;
				const eligible = data.rows.filter((r) => r.action === 'publish');
				const cuttingNew = eligible.some((row) => row.steps.some((step) => step.kind === 'bump'));
				note(`publish plan — ${eligible.length} of ${data.rows.length} eligible, nothing written`, data);
				offerConfirm({
					title: eligible.length === 1
						? cuttingNew
							? `Cut and publish ${eligible[0]?.npm ?? eligible[0]?.id}@${eligible[0]?.version}?`
							: `Publish ${eligible[0]?.npm ?? eligible[0]?.id}@${eligible[0]?.version}?`
						: eligible.length
							? `Publish ${eligible.length} packages?`
							: 'Nothing to publish',
					hint: eligible.length
						? cuttingNew
							? `${publishAuthHint} The current local version is already on npm. Confirming cuts a new version.`
							: publishAuthHint
						: ids.length === 1
							? `${ids[0]}: ${data.rows[0]?.reason ?? 'cannot publish'}`
							: 'No listed package is ready to publish.',
					items: eligible.length ? eligible.flatMap(publishItems) : data.rows.map((row) => `${row.id}  ${row.reason ?? 'skipped'}`),
					confirmLabel: eligible.length === 1 ? `Publish ${eligible[0]?.version}` : `Publish ${eligible.length}`,
					variant: 'danger',
					canApply: eligible.length > 0,
					run: () => void applyPublish(eligible.map((row) => row.id)),
				});
			},
			{ closeConfirm: false },
		);
	}

	async function applyPublish(ids: string[]): Promise<void> {
		const label = ids.length === 1 ? ids[0] : `${ids.length} packages`;
		await run(`publishing ${label}`, async () => {
			const data = (await call('/api/publish', {
				method: 'POST',
				body: JSON.stringify({
					apply: true,
					ids,
					kind: ids.length === 1 ? (bumpKind[ids[0] ?? ''] ?? 'patch') : 'patch',
					otp: publishOtp.trim() ? publishOtp.trim() : undefined,
				}),
			})) as { rows: PublishRow[] };
			const published = data.rows.filter((r) => r.reason?.startsWith('published ')).length;
			note(`publish --apply — ${published} published`, { rows: data.rows });
			publishOtp = '';
			await refresh();
		});
	}

	async function startPluginJob(plugin: string, action: string, ids: string[], label: string): Promise<void> {
		if (ids.length === 0) return;
		const scope = ids.length === 1 ? ids[0] : `${ids.length} sites`;
		await run(
			`planning ${plugin} ${action} ${scope}`,
			async () => {
				const data = await call('/api/plugin', {
					method: 'POST',
					body: JSON.stringify({ id: plugin, action, ids, apply: false }),
				});
				const writeIds = pluginPlanWriteIds(data);
				const applyIds = writeIds ?? [...ids];
				const items = rowLines(data);
				note(`${plugin} ${action} plan ${scope}`, data);
				offerConfirm({
					title: applyIds.length
						? `${label} for ${applyIds.length === 1 ? applyIds[0] : `${applyIds.length} sites`}?`
						: `Nothing to ${label.toLowerCase()}`,
					hint: applyIds.length
						? action === 'push'
							? 'git push origin <branch> only. Never --force. Never the IngotVault backup remote.'
							: 'The FilePress plugin runs this in each listed checkout. LocalHelm does not reimplement it.'
						: writeIds
							? 'Already current — nothing to write.'
							: 'The plan found nothing to do.',
					items: items.length ? items : ['Nothing to do.'],
					confirmLabel: applyIds.length === 1 ? label : `${label} ${applyIds.length}`,
					canApply: applyIds.length > 0,
					run: () => void applyPluginJob(plugin, action, applyIds),
				});
			},
			{ closeConfirm: false },
		);
	}

	async function applyPluginJob(plugin: string, action: string, ids: string[]): Promise<void> {
		const scope = ids.length === 1 ? ids[0] : `${ids.length} sites`;
		await run(`${plugin} ${action} ${scope}`, async () => {
			const data = await call('/api/plugin', {
				method: 'POST',
				body: JSON.stringify({ id: plugin, action, ids, apply: true }),
			});
			note(`${plugin} ${action} --apply ${scope}`, data);
			await refresh();
		});
	}

	async function startCascade(id: string): Promise<void> {
		await run(
			`planning cascade ${id}`,
			async () => {
				const data = (await call('/api/cascade', {
					method: 'POST',
					body: JSON.stringify({ id, apply: false }),
				})) as { to: string; npm: string; rows: { action: string; writes?: boolean }[]; note: string };
				const n = data.rows.filter((r) => r.action === 'retarget').length;
				note(`cascade plan ${data.npm}@${data.to} — ${n} pin(s) to retarget. ${data.note}`, data);
				offerConfirm({
					title: n ? `Write ${data.npm}@${data.to} pins?` : `Nothing to cascade for ${id}`,
					hint: n
						? `${data.note} Writes pins and lockfiles. Commits by default.`
						: data.note || 'No dependents need a pin update.',
					items: rowLines(data).length ? rowLines(data) : ['Nothing to retarget.'],
					confirmLabel: n ? `Write ${data.npm}@${data.to}` : 'Write pins',
					canApply: n > 0,
					run: () => void applyCascade(id),
				});
			},
			{ closeConfirm: false },
		);
	}

	async function applyCascade(id: string): Promise<void> {
		await run(`cascading ${id}`, async () => {
			const data = (await call('/api/cascade', {
				method: 'POST',
				body: JSON.stringify({ id, apply: true }),
			})) as { to: string; npm: string; rows: { action: string; writes?: boolean }[]; note: string };
			note(`cascade ${data.npm}@${data.to} — wrote ${data.rows.filter((r) => r.writes).length} pin(s)`, data);
			await refresh();
		});
	}

	async function startExport(): Promise<void> {
		await run(
			'planning export',
			async () => {
				const data = (await call('/api/export', { method: 'POST', body: JSON.stringify({ apply: false }) })) as {
					file: string;
				};
				note(`export plan — would write ${data.file}, nothing written`, data);
				offerConfirm({
					title: 'Write the JSON export?',
					hint: 'Overwrites the inventory JSON file. Does not change any project.',
					items: [data.file],
					confirmLabel: 'Write JSON',
					canApply: Boolean(data.file),
					run: () => void applyExport(),
				});
			},
			{ closeConfirm: false },
		);
	}

	async function applyExport(): Promise<void> {
		await run('writing the JSON export', async () => {
			const data = (await call('/api/export', { method: 'POST', body: JSON.stringify({ apply: true }) })) as {
				file: string;
			};
			note(`export --apply — wrote ${data.file}`, data);
		});
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
				title: 'Local version is ahead of npm. Publish will push if needed, then npm publish.',
			});
		}
		if (row.git.dirty) out.push({ text: `dirty${dirtDetail(row) ? ` — ${dirtDetail(row)}` : ''}`, tone: 'warn' });
		if (row.git.busy) out.push({ text: `mid-${row.git.busy}`, tone: 'bad' });
		if (row.cascadeBehind) {
			const behind = row.pins.filter((pin) => pin.kind === 'registry' && pin.onLatest === false);
			const names = behind.map((pin) => `${pin.name} ${pin.spec}`).join(', ');
			out.push({
				text: behind.length === 1 ? `${behind[0]?.name} pin behind` : `${behind.length} pins behind`,
				tone: 'warn',
				title: names
					? `${names} in this package.json would not install the latest published version. Cascade from that package to rewrite the pin.`
					: 'A registry pin in this package.json would not install the latest published version.',
			});
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
			activityOpen = sessionStorage.getItem('localhelm.activity') === '1';
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
					<span class="group-label">Write — confirm, then apply</span>
					<div class="group-buttons">
						<button
							class="btn btn-write"
							disabled={Boolean(busy)}
							onclick={() => startPull()}
							title="Shows which clean, behind repos would fast-forward. Confirm in the modal to pull."
						>
							Pull
						</button>
						<button
							class="btn btn-write"
							disabled={Boolean(busy)}
							onclick={() => startPush()}
							title="Shows which clean, ahead repos would push to origin. Confirm in the modal. Never --force."
						>
							Push all
						</button>
						<button
							class="btn btn-write"
							disabled={Boolean(busy)}
							onclick={() => startExport()}
							title="Shows the inventory JSON path. Confirm in the modal to write it."
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
		<button
			type="button"
			class="tab activity-tab"
			class:active={activityOpen}
			class:hot={activityUnseen}
			onclick={() => setActivityOpen(!activityOpen)}
		>
			Activity
			{#if entries.length}<span class="count">{entries.length}</span>{/if}
			{#if activityUnseen}<span class="count">new</span>{/if}
		</button>
	</nav>

	<div class="workspace">
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
						{#if (inventory?.digest.unpublishedAhead ?? 0) > 0}
							<div class="group-buttons">
								<button
									class="btn btn-write"
									disabled={Boolean(busy) || shipRows.length === 0}
									onclick={() => startPublish(shipRows.map((row) => row.id))}
									title="Shows what publish would do for every public enrolled package. Confirm in the modal."
								>
									Publish all
								</button>
							</div>
						{/if}
					</div>

					{#if (inventory?.digest.unpublishedAhead ?? 0) > 0}
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
											<button
												class="btn btn-sm btn-write"
												disabled={Boolean(busy)}
												onclick={() => startPublish([row.id])}
												title="Shows bump, push, and npm publish steps. Confirm in the modal."
											>
												Publish
											</button>
										</div>
									{/if}
									{#if (row.git.ahead ?? 0) > 0}
										<div class="bump">
											<button
												class="btn btn-sm btn-write"
												disabled={Boolean(busy)}
												onclick={() => startPush([row.id])}
												title="Shows the origin URL and commit count. Confirm in the modal. Never --force."
											>
												Push
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
											<button
												class="btn btn-sm btn-write"
												disabled={Boolean(busy)}
												onclick={() => startCascade(row.id)}
												title="Shows which dependents would get the new pin. Confirm in the modal to write."
											>
												Write pins
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
										<button
											class="btn btn-sm btn-write"
											disabled={Boolean(busy)}
											onclick={() => startCascade(target.id)}
											title="Shows which dependents would get the new pin. Confirm in the modal to write."
										>
											Write pins
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
								class="btn btn-write"
								disabled={Boolean(busy) || filepressSyncIds.length === 0}
								onclick={() => startPluginJob(filepressBoard.plugin, 'sync', filepressSyncIds, 'Sync engine')}
								title="Shows which FilePress sites need an engine sync. Confirm in the modal to write."
							>
								Sync engine
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
							<p class="hint">Check rows, then bump, push, or remove. Removing never deletes a folder. Version bump only writes package.json — publish lives on Today.</p>
						</div>
						<div class="group-buttons">
							<button
								class="btn btn-write"
								disabled={Boolean(busy) || !checkedIds.length}
								onclick={() => startBump(checkedIds)}
								title="Shows the next version for each checked row. Confirm in the modal. No tag, no publish."
							>
								Bump{checkedIds.length ? ` (${checkedIds.length})` : ''}
							</button>
							<button
								class="btn btn-write"
								disabled={Boolean(busy) || !checkedIds.length}
								onclick={() => startPush(checkedIds)}
								title="Shows which checked repos would push to origin. Confirm in the modal. Never --force."
							>
								Push{checkedIds.length ? ` (${checkedIds.length})` : ''}
							</button>
							<button
								class="btn btn-write"
								disabled={Boolean(busy) || !checkedIds.length}
								onclick={() => startUnenroll()}
								title="Shows which fleet rows would be removed. Confirm in the modal. Never deletes a folder."
							>
								Remove{checkedIds.length ? ` (${checkedIds.length})` : ''}
							</button>
						</div>
					</div>

					<div class="table-wrap">
						<table>
							<thead>
								<tr>
									<th class="tick">
										<input
											type="checkbox"
											aria-label="Select all fleet rows"
											checked={fleetAllChecked}
											indeterminate={fleetSomeChecked}
											onchange={(event) => toggleFleetAll(event.currentTarget.checked)}
										/>
									</th>
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
												<button
													class="btn btn-sm btn-write"
													disabled={Boolean(busy)}
													onclick={() => startBump([row.id])}
													title="Shows the next version. Confirm in the modal to write package.json. No tag, no publish."
												>
													Bump
												</button>
												{#if (row.git.ahead ?? 0) > 0}
													<button
														class="btn btn-sm btn-write"
														disabled={Boolean(busy)}
														onclick={() => startPush([row.id])}
														title="Shows the origin URL and commit count. Confirm in the modal. Never --force."
													>
														Push
													</button>
												{/if}
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
						Check rows for bulk bump, push, or remove. Each write button plans first, then asks you to confirm. Cancel leaves disk unchanged.
						Publish lives on Today: bump and push only if needed, then <code>npm publish</code>. Never <code>--force</code>. Never the IngotVault backup remote.
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
							<button
								class="btn btn-write"
								disabled={Boolean(busy) || !checkedScan.length}
								onclick={() => startEnroll()}
								title="Shows which folders would join the fleet. Confirm in the modal to write localhelm.fleet.json."
							>
								Add to fleet{checkedScan.length ? ` (${checkedScan.length})` : ''}
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
								Check rows, then run a job on the selection.
							</p>
						</div>
						<div class="group-buttons">
							{#each boardActions(board) as act (act.id)}
								<button
									class="btn btn-write"
									disabled={Boolean(busy) || checkedSiteIds(board, act.id).length === 0}
									onclick={() => startPluginJob(board.plugin, act.id, checkedSiteIds(board, act.id), act.label)}
									title={`Shows what ${act.label.toLowerCase()} would do for the checked sites. Confirm in the modal.`}
								>
									{act.label}{checkedSiteIds(board, act.id).length ? ` (${checkedSiteIds(board, act.id).length})` : ''}
								</button>
							{/each}
						</div>
					</div>
					<div class="table-wrap">
						<table>
							<thead>
								<tr>
									<th class="tick">
										<input
											type="checkbox"
											aria-label={`Select all ${board.title} rows`}
											checked={siteAllChecked(board)}
											indeterminate={board.rows.some((row) => selectedSites[row.id]) && !siteAllChecked(board)}
											onchange={(event) => toggleSiteAll(board, event.currentTarget.checked)}
										/>
									</th>
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
										<td class="tick">
											<input type="checkbox" aria-label={`select ${row.id}`} bind:checked={selectedSites[row.id]} />
										</td>
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
														class="btn btn-sm btn-write"
														disabled={Boolean(busy)}
														onclick={() => startPluginJob(board.plugin, act.id, [row.id], act.label)}
														title={`Shows what ${act.label.toLowerCase()} would do. Confirm in the modal.`}
													>
														{act.label}
													</button>
												{/each}
											</div>
										</td>
									</tr>
								{/each}
								{#if !board.rows.length}
									<tr><td class="empty" colspan={board.columns.length + 3}>No rows from this plugin.</td></tr>
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
	</main>

	{#if activityOpen}
		<button type="button" class="drawer-backdrop" aria-label="Close activity" onclick={() => setActivityOpen(false)}></button>
		<aside class="drawer" aria-label="Activity">
			<div class="section-head">
				<div>
					<h2>Activity</h2>
					<p class="hint">Every plan and write, newest first — the same output the CLI prints.</p>
				</div>
				<div class="group-buttons">
					{#if entries.length}
						<button class="btn btn-sm" onclick={() => (entries = [])}>Clear</button>
					{/if}
					<button class="btn btn-sm" onclick={() => setActivityOpen(false)}>Close</button>
				</div>
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
		</aside>
	{/if}
	</div>
</div>

<svelte:window
	onkeydown={(event) => {
		if (event.key === 'Escape' && activityOpen && !confirmOpen) setActivityOpen(false);
	}}
/>

<ConfirmModal
	bind:open={confirmOpen}
	title={confirmTitle}
	hint={confirmHint}
	confirmLabel={confirmLabel}
	variant={confirmVariant}
	busy={Boolean(busy)}
	canApply={confirmCanApply}
	items={confirmItems}
	onconfirm={() => {
		confirmRun?.();
	}}
/>

<style>
	:global(html),
	:global(body) {
		height: 100%;
		margin: 0;
		overflow: hidden;
	}

	.shell {
		height: 100vh;
		display: flex;
		flex-direction: column;
		overflow: hidden;
		background: #1c1c21;
		color: #ececef;
		font-family:
			ui-sans-serif,
			system-ui,
			sans-serif;
	}

	header {
		flex-shrink: 0;
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
		flex-shrink: 0;
		gap: 0.35rem;
		padding: 0.85rem 1.5rem 0;
		background: #000;
		border-bottom: 1px solid #1f1f22;
	}

	.activity-tab {
		margin-left: auto;
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

	.workspace {
		flex: 1;
		min-height: 0;
		display: flex;
		position: relative;
		overflow: hidden;
	}

	main {
		flex: 1;
		min-width: 0;
		min-height: 0;
		overflow: auto;
		display: flex;
		flex-direction: column;
		gap: 1rem;
		padding: 1.1rem 1.5rem 1.5rem;
	}

	.drawer-backdrop {
		display: none;
	}

	.drawer {
		width: min(26rem, 100%);
		flex-shrink: 0;
		height: 100%;
		overflow: auto;
		display: flex;
		flex-direction: column;
		background: #111114;
		border-left: 1px solid #3d3d44;
		padding: 0.95rem 1rem 1.25rem;
		z-index: 20;
	}

	.drawer .log {
		max-height: none;
		flex: 1;
	}

	@media (max-width: 1100px) {
		.drawer-backdrop {
			display: block;
			position: absolute;
			inset: 0;
			border: 0;
			padding: 0;
			background: rgb(0 0 0 / 0.45);
			cursor: pointer;
			z-index: 15;
		}

		.drawer {
			position: absolute;
			top: 0;
			right: 0;
			bottom: 0;
			width: min(26rem, 92vw);
			box-shadow: -16px 0 40px rgb(0 0 0 / 0.45);
		}
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
