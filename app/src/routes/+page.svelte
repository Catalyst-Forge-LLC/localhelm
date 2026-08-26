<script lang="ts">
	import { onMount } from 'svelte';
	import { replaceState } from '$app/navigation';
	import ConfirmModal from '$lib/ConfirmModal.svelte';
	import AddProjectsModal from '$lib/AddProjectsModal.svelte';
	import CrossChips from '$lib/CrossChips.svelte';
	import Icon from '$lib/Icon.svelte';
	import IconButton from '$lib/IconButton.svelte';
	import InfoHint from '$lib/InfoHint.svelte';
	import Tooltip from '$lib/Tooltip.svelte';
	import { activityLinkedIds } from '$lib/activityLinks';
	import { crosswalkChips } from '$lib/crosswalk';
	import { formatPluginPlanLines, pluginPlanWriteIds } from '$lib/pluginPlan';
	import { formatBrief } from '$lib/briefFormat';
	import { familyMemberNames } from '$lib/family';
	import { portFamilies, portLooks } from '$lib/looks';
	import { plainGitError, whyNotPublish, whyNotPush, writableCascadeCount } from '$lib/writeGate';
	import { bulkProgressLabel } from '$lib/bulkProgress';
	import { siteCellValue, siteNeedsEngineSync, siteSyncLabel, siteTableColumns } from '$lib/siteDisplay';
	import {
		idsToSelection,
		parseListParam,
		selectionToIds,
		serializeListParam,
	} from '$lib/urlListParam';

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
	type CascadeTarget = { id: string; npm: string; latest: string; behind: number; linked: number; writable: number };
	type PluginBoard = {
		plugin: string;
		title: string;
		note?: string;
		tab?: 'sites' | 'ports';
		rowLabel?: string;
		columns: { id: string; label: string }[];
		rows: {
			id: string;
			label?: string;
			href?: string;
			cells: Record<string, string>;
			actions: { id: string; label: string; write: boolean; icon?: string }[];
		}[];
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
	type BumpPlan = {
		id: string;
		from: string | null;
		to: string | null;
		action: string;
		reason?: string;
		commit?: 'commit' | 'skip';
		commitMessage?: string;
		commitReason?: string;
	};
	type LogEntry = { at: string; time: string; title: string; body: string };
	type TabId = 'today' | 'fleet' | 'sites' | 'ports';
	type PortPane = 'leases' | 'observed';

	let inventory = $state<Inventory | null>(null);
	let tab = $state<TabId>('today');
	let portPane = $state<PortPane>('leases');
	let activityOpen = $state(false);
	let activityUnseen = $state(false);
	let urlSyncReady = $state(false);
	let cwd = $state('');
	let port = $state<string | null>(null);
	let portSource = $state<string | null>(null);
	let fetchedAt = $state<string | null>(null);

	let scanRoot = $state('..');
	let candidates = $state<Candidate[]>([]);
	let addOpen = $state(false);
	let selectedScan = $state<Record<string, boolean>>({});
	let selectedIds = $state<Record<string, boolean>>({});
	let selectedSites = $state<Record<string, boolean>>({});
	let selectedPorts = $state<Record<string, boolean>>({});
	let bumpKind = $state<Record<string, BumpKind>>({});

	let pluginBoards = $state<PluginBoard[]>([]);
	let publishOtp = $state('');
	let npmUser = $state<string | null>(null);
	let publishAuthHint = $state('');
	let confirmOpen = $state(false);
	let confirmTitle = $state('');
	let confirmHint = $state('');
	let confirmLabel = $state('Confirm');
	let confirmVariant = $state<'write' | 'danger'>('write');
	let confirmItems = $state<string[]>([]);
	let confirmCanApply = $state(true);
	let confirmShowOtp = $state(false);
	let confirmRun = $state<(() => void) | null>(null);
	let statusReady = $state(false);
	let archivedIds = $state<string[]>([]);
	let showArchived = $state(false);
	let showParked = $state(false);
	let briefCopied = $state(false);
	let copiedKey = $state('');

	let entries = $state<LogEntry[]>([]);
	let busy = $state('');
	let error = $state('');

	const enrolledIds = $derived(new Set((inventory?.projects ?? []).map((p) => p.id)));
	const archivedSet = $derived(new Set(archivedIds));
	const visibleProjects = $derived(
		(inventory?.projects ?? []).filter((row) => showArchived || !archivedSet.has(row.id)),
	);
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
			.filter((row) => row.unpublishedAhead && !whyNotPublish(row))
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
					writable: writableCascadeCount(pub.id, projects),
				};
			})
			.filter((row) => row.behind > 0 || row.linked > 0);
	});
	const attentionRows = $derived(visibleProjects.filter((row) => rowNeedsYou(row)));
	const siteBoards = $derived(pluginBoards.filter((board) => (board.tab ?? 'sites') === 'sites'));
	const portBoards = $derived(pluginBoards.filter((board) => board.tab === 'ports'));
	const filepressBoard = $derived(siteBoards.find((board) => board.plugin === 'filepress') ?? siteBoards[0] ?? null);
	const sitesNeedingYou = $derived((filepressBoard?.rows ?? []).filter((row) => siteNeedsYou(row.cells)));
	const leaseBoardAll = $derived(portBoards.find((board) => board.title === 'Leases') ?? portBoards[0] ?? null);
	const parkedLeaseCount = $derived((leaseBoardAll?.rows ?? []).filter((row) => row.cells.parked === 'yes').length);
	const leaseBoard = $derived(
		leaseBoardAll
			? {
					...leaseBoardAll,
					rows: leaseBoardAll.rows.filter((row) => showParked || row.cells.parked !== 'yes'),
				}
			: null,
	);
	const observedBoard = $derived(portBoards.find((board) => board.title === 'Observed') ?? null);
	const visiblePortBoard = $derived(portPane === 'observed' ? observedBoard : leaseBoard);
	const portsNeedingYou = $derived((leaseBoard?.rows ?? []).filter((row) => portNeedsYou(row.cells)));
	const portFamilyCards = $derived(
		portFamilies({
			fleetIds: visibleProjects.map((row) => row.id),
			leaseRows: leaseBoard?.rows ?? [],
		}),
	);
	const portLookCards = $derived(
		portLooks({
			fleetIds: visibleProjects.map((row) => row.id),
			leaseRows: leaseBoard?.rows ?? [],
		}),
	);
	const cascadeOnlyRows = $derived(
		cascadeTargets.filter(
			(target) =>
				target.writable > 0 &&
				!attentionRows.some((row) => row.id === target.id) &&
				(showArchived || !archivedSet.has(target.id)),
		),
	);
	const todayCount = $derived(
		attentionRows.length +
			cascadeOnlyRows.length +
			sitesNeedingYou.length +
			portsNeedingYou.length +
			portLookCards.length,
	);
	const filepressSyncIds = $derived(sitesNeedingYou.map((row) => row.id));
	const checkedPublishIds = $derived(checkedIds.filter((id) => {
		const row = inventory?.projects.find((p) => p.id === id);
		return row ? !whyNotPublish(row) : false;
	}));
	const unpublishedPublishIds = $derived(
		shipRows.filter((row) => row.unpublishedAhead && !whyNotPublish(row)).map((row) => row.id),
	);
	const filepressPushIds = $derived(
		(filepressBoard?.rows ?? [])
			.filter((row) => row.actions.some((act) => act.id === 'push'))
			.map((row) => row.id),
	);
	const fleetIds = $derived(visibleProjects.map((row) => row.id));
	const siteIds = $derived((filepressBoard?.rows ?? []).map((row) => row.id));
	const leaseIds = $derived((leaseBoardAll?.rows ?? []).map((row) => row.id));
	const knownIds = $derived([...new Set([...fleetIds, ...siteIds, ...leaseIds])]);
	const quietSiteIds = $derived(
		(leaseBoard?.rows ?? [])
			.filter((row) => row.id.endsWith('-site') && row.cells.listening === 'yes')
			.map((row) => row.id),
	);
	const guessRecipeIds = $derived(
		(leaseBoard?.rows ?? []).filter((row) => !row.cells.recipe || row.cells.recipe === '—').map((row) => row.id),
	);
	const fleetAllChecked = $derived(fleetIds.length > 0 && fleetIds.every((id) => selectedIds[id]));
	const fleetSomeChecked = $derived(checkedIds.length > 0 && !fleetAllChecked);
	const checkedSiteIdList = $derived(selectionToIds(selectedSites));
	const checkedPortIdList = $derived(selectionToIds(selectedPorts));

	function persistNpmUser(value: string): void {
		try {
			sessionStorage.setItem('localhelm.npmUser', value);
		} catch {
			/* ignore quota / private mode */
		}
	}

	function parseTab(raw: string | null): TabId | null {
		if (raw === 'today' || raw === 'fleet' || raw === 'sites' || raw === 'ports') return raw;
		return null;
	}

	function parsePortPane(raw: string | null): PortPane | null {
		if (raw === 'leases' || raw === 'observed') return raw;
		return null;
	}

	function setTab(next: TabId): void {
		tab = next;
	}

	function setPortPane(next: PortPane): void {
		portPane = next;
	}

	function setActivityOpen(next: boolean): void {
		activityOpen = next;
		if (next) activityUnseen = false;
	}

	function restoreUrlState(params: URLSearchParams): void {
		const tabParam = parseTab(params.get('tab'));
		if (tabParam) tab = tabParam;
		else {
			try {
				const saved = sessionStorage.getItem('localhelm.tab');
				const fromSession = parseTab(saved);
				if (fromSession) tab = fromSession;
				sessionStorage.removeItem('localhelm.tab');
			} catch {
				/* ignore */
			}
		}

		const portsParam = parsePortPane(params.get('ports'));
		if (portsParam) portPane = portsParam;
		else {
			try {
				const saved = sessionStorage.getItem('localhelm.portPane');
				const fromSession = parsePortPane(saved);
				if (fromSession) portPane = fromSession;
				sessionStorage.removeItem('localhelm.portPane');
			} catch {
				/* ignore */
			}
		}

		if (params.has('activity')) {
			activityOpen = params.get('activity') === '1';
		} else {
			try {
				activityOpen = sessionStorage.getItem('localhelm.activity') === '1';
				sessionStorage.removeItem('localhelm.activity');
			} catch {
				/* ignore */
			}
		}

		const fleetParam = params.get('fleet');
		if (fleetParam !== null) selectedIds = idsToSelection(parseListParam(fleetParam));
		const sitesParam = params.get('sites');
		if (sitesParam !== null) selectedSites = idsToSelection(parseListParam(sitesParam));
		const leasesParam = params.get('leases');
		if (leasesParam !== null) selectedPorts = idsToSelection(parseListParam(leasesParam));
	}

	$effect(() => {
		if (!urlSyncReady) return;
		const params = new URLSearchParams(typeof window !== 'undefined' ? window.location.search : '');
		if (tab === 'today') params.delete('tab');
		else params.set('tab', tab);
		if (portPane === 'leases') params.delete('ports');
		else params.set('ports', portPane);
		if (activityOpen) params.set('activity', '1');
		else params.delete('activity');

		const fleetCsv = serializeListParam(selectionToIds(selectedIds));
		if (fleetCsv) params.set('fleet', fleetCsv);
		else params.delete('fleet');

		const sitesCsv = serializeListParam(checkedSiteIdList);
		if (sitesCsv) params.set('sites', sitesCsv);
		else params.delete('sites');

		const leasesCsv = serializeListParam(checkedPortIdList);
		if (leasesCsv) params.set('leases', leasesCsv);
		else params.delete('leases');

		const next = params.toString();
		const current = typeof window !== 'undefined' ? window.location.search.slice(1) : '';
		if (next !== current) {
			replaceState(next ? `?${next}` : window.location.pathname, {});
		}
	});

	function rowNeedsYou(row: Project): boolean {
		return badges(row).some((badge) => badge.text !== 'nothing to do');
	}

	function siteNeedsYou(cells: Record<string, string>): boolean {
		return siteNeedsEngineSync(cells);
	}

	function siteNeedReason(cells: Record<string, string>): string {
		const update = (cells.update ?? '').trim();
		const headers = (cells.headers ?? '').trim();
		const updateLc = update.toLowerCase();
		const parts: string[] = [];
		if (update && update !== '—' && !updateLc.startsWith('already') && !updateLc.startsWith('skip')) {
			parts.push(update);
		}
		if (headers.toLowerCase().startsWith('merge')) parts.push(headers);
		return parts.join(' · ') || update || '—';
	}

	function portNeedsYou(cells: Record<string, string>): boolean {
		return cells.listening === 'no' || cells.conflict === 'yes' || cells.firewall === 'needs-elevation';
	}


	function canPublish(row: Project): boolean {
		return !whyNotPublish(row);
	}

	function canPush(row: Project): boolean {
		return !whyNotPush(row.git);
	}

	function cascadeFor(id: string): CascadeTarget | undefined {
		return cascadeTargets.find((row) => row.id === id);
	}

	function todayNeed(row: Project): 'publish' | 'push' | 'pins' | 'look' {
		if (row.unpublishedAhead && canPublish(row)) return 'publish';
		if (canPush(row)) return 'push';
		if ((cascadeFor(row.id)?.writable ?? 0) > 0) return 'pins';
		return 'look';
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

	function formatEntryTime(at: string): string {
		const when = new Date(at);
		return Number.isNaN(when.getTime()) ? at : when.toLocaleTimeString();
	}

	function toLog(row: { at: string; title: string; body: string }): LogEntry {
		return { at: row.at, time: formatEntryTime(row.at), title: row.title, body: row.body };
	}

	async function loadActivity(): Promise<void> {
		try {
			const data = (await call('/api/activity')) as { entries: { at: string; title: string; body: string }[] };
			entries = (data.entries ?? []).map(toLog);
		} catch {
			/* keep whatever is already on screen */
		}
	}

	function note(title: string, data: unknown): void {
		const at = new Date().toISOString();
		const body = JSON.stringify(data, null, 2);
		entries = [{ at, time: formatEntryTime(at), title, body }, ...entries].slice(0, 200);
		if (!activityOpen) activityUnseen = true;
		void call('/api/activity', { method: 'POST', body: JSON.stringify({ title, data }) })
			.then((res) => {
				const saved = res as { entries: { at: string; title: string; body: string }[] };
				if (Array.isArray(saved.entries)) entries = saved.entries.map(toLog);
			})
			.catch((err) => {
				error = err instanceof Error ? err.message : String(err);
			});
	}

	async function clearActivityLog(): Promise<void> {
		await run(
			'clearing activity',
			async () => {
				await call('/api/activity', { method: 'DELETE' });
				entries = [];
				activityUnseen = false;
			},
			{ closeConfirm: false },
		);
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

	async function eachNamed(verb: string, names: string[], fn: (name: string) => Promise<void>): Promise<void> {
		for (let i = 0; i < names.length; i++) {
			const name = names[i];
			if (!name) continue;
			busy = bulkProgressLabel(verb, i + 1, names.length, name);
			await fn(name);
		}
	}

	function inventoryDigest(projects: Project[]): Inventory['digest'] {
		return {
			projects: projects.length,
			dirty: projects.filter((row) => row.git.dirty).length,
			unpublishedAhead: projects.filter((row) => row.unpublishedAhead).length,
			cascadeBehind: projects.filter((row) => row.cascadeBehind > 0).length,
			missing: projects.filter((row) => row.missing).length,
			npmErrors: projects.filter((row) => row.npm.status === 'error').length,
		};
	}

	function mergeInventory(prev: Inventory, next: Inventory): Inventory {
		const byId = new Map(prev.projects.map((row) => [row.id, row]));
		for (const row of next.projects) byId.set(row.id, row);
		const order = prev.projects.map((row) => row.id);
		const projects = [
			...order.map((id) => byId.get(id)).filter((row): row is Project => Boolean(row)),
			...next.projects.filter((row) => !order.includes(row.id)),
		];
		return { ...prev, projects, digest: inventoryDigest(projects) };
	}

	async function loadPluginBoards(): Promise<void> {
		try {
			const plug = (await call('/api/plugins')) as { boards: PluginBoard[] };
			pluginBoards = plug.boards;
		} catch {
			/* keep the last boards */
		}
	}

	async function loadStatus(opts: { fetchRemotes?: boolean; ids?: string[]; extras?: boolean } = {}): Promise<void> {
		const ids = opts.ids?.filter(Boolean) ?? [];
		const scoped = ids.length > 0;
		const query = new URLSearchParams();
		if (opts.fetchRemotes) query.set('fetch', '1');
		const csv = scoped ? serializeListParam(ids) : null;
		if (csv) query.set('ids', csv);
		const suffix = query.toString() ? `?${query}` : '';
		const data = (await call(`/api/status${suffix}`)) as {
			inventory: Inventory | null;
			scanRoot: string;
			cwd: string;
			port: string | null;
			portSource: string | null;
			npmUser?: string | null;
		};
		if (scoped && inventory && data.inventory) inventory = mergeInventory(inventory, data.inventory);
		else inventory = data.inventory;
		cwd = data.cwd;
		port = data.port;
		portSource = data.portSource;
		if (data.npmUser) {
			npmUser = data.npmUser;
			persistNpmUser(data.npmUser);
		}
		if (opts.fetchRemotes && !scoped) fetchedAt = new Date().toLocaleTimeString();
		if (!candidates.length) scanRoot = data.scanRoot;
		const kinds = { ...bumpKind };
		for (const row of data.inventory?.projects ?? []) kinds[row.id] ??= 'patch';
		bumpKind = kinds;
		if (opts.extras !== false && !scoped) {
			await loadPluginBoards();
			await loadActivity();
			try {
				const archived = (await call('/api/archive')) as { ids?: string[] };
				archivedIds = Array.isArray(archived.ids) ? archived.ids : [];
			} catch {
				/* keep the last archive list */
			}
		}
		statusReady = true;
	}

	async function refresh(fetchRemotes = false): Promise<void> {
		await run(fetchRemotes ? 'fetching remotes, then reading status' : 'reading status', async () => {
			const fleet = inventory?.projects.map((row) => row.id) ?? [];
			if (fetchRemotes && fleet.length) {
				await eachNamed('fetching remotes', fleet, async (id) => {
					await call('/api/fetch', { method: 'POST', body: JSON.stringify({ ids: [id] }) });
				});
				fetchedAt = new Date().toLocaleTimeString();
				busy = 'reading status';
				await loadStatus({ extras: true });
				return;
			}
			await loadStatus({ fetchRemotes, extras: true });
		});
	}

	async function refreshRows(ids: string[], fetchRemotes = false): Promise<void> {
		const named = ids.filter(Boolean);
		if (!named.length) {
			await refresh(fetchRemotes);
			return;
		}
		const label =
			named.length === 1 ? `reading ${named[0]}` : `reading ${named.length} projects`;
		await run(fetchRemotes ? `fetching remotes, then ${label}` : label, async () => {
			await loadStatus({ fetchRemotes, ids: named, extras: false });
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
		showOtp?: boolean;
		run?: () => void;
	}): void {
		confirmTitle = spec.title;
		confirmHint = spec.hint;
		confirmItems = spec.items;
		confirmLabel = spec.confirmLabel;
		confirmVariant = spec.variant ?? 'write';
		confirmCanApply = spec.canApply;
		confirmShowOtp = Boolean(spec.showOtp);
		confirmRun = spec.canApply && spec.run ? spec.run : null;
		confirmOpen = true;
	}

	function rowLines(data: unknown): string[] {
		return formatPluginPlanLines(data);
	}

	function openPortsFamily(ids: string[]): void {
		selectedPorts = idsToSelection(ids);
		portPane = 'leases';
		setTab('ports');
	}

	function chipsFor(id: string, hide?: 'fleet' | 'sites' | 'ports') {
		return crosswalkChips(id, { fleetIds, siteIds, leaseIds, hide });
	}

	function openCross(id: string, kind: 'fleet' | 'sites' | 'ports'): void {
		if (kind === 'fleet') {
			selectedIds = { ...selectedIds, [id]: true };
			setTab('fleet');
			return;
		}
		if (kind === 'sites') {
			selectedSites = { ...selectedSites, [id]: true };
			setTab('sites');
			return;
		}
		openPortsFamily([id]);
	}

	function activityJump(id: string): void {
		if (leaseIds.includes(id)) {
			openPortsFamily([id]);
			return;
		}
		if (siteIds.includes(id)) {
			selectedSites = { ...selectedSites, [id]: true };
			setTab('sites');
			return;
		}
		selectedIds = { ...selectedIds, [id]: true };
		setTab('fleet');
	}

	async function copyValue(key: string, value: string): Promise<void> {
		try {
			await navigator.clipboard.writeText(value);
			copiedKey = key;
			setTimeout(() => {
				if (copiedKey === key) copiedKey = '';
			}, 1500);
		} catch (err) {
			error = err instanceof Error ? err.message : String(err);
		}
	}

	function healthTip(row: PluginBoard['rows'][number]): string {
		const lines = [
			row.cells.healthDetail,
			row.cells.recipe && row.cells.recipe !== '—' ? `Recipe: ${row.cells.recipe}` : '',
			row.cells.kind && row.cells.kind !== '—' ? `Kind: ${row.cells.kind}` : '',
			row.href ? row.href : '',
		].filter(Boolean);
		return lines.join('\n') || 'No recipe facts yet.';
	}

	function currentBrief(): string {
		return formatBrief({
			projects: inventory?.projects ?? [],
			leases: (leaseBoardAll?.rows ?? []).map((row) => ({
				id: row.id,
				listening: row.cells.listening === 'yes',
				recipe: row.cells.recipe ?? '—',
				parked: row.cells.parked === 'yes',
			})),
			activityTitles: entries.map((entry) => entry.title),
		});
	}

	async function copyBrief(): Promise<void> {
		const text = currentBrief();
		try {
			await navigator.clipboard.writeText(text);
			briefCopied = true;
			note('copied brief', text);
			setTimeout(() => {
				briefCopied = false;
			}, 2000);
		} catch (err) {
			error = err instanceof Error ? err.message : String(err);
		}
	}

	function familyIdsFromChecked(): string[] {
		const names = (leaseBoard?.rows ?? []).map((row) => row.id);
		return [...new Set(checkedPortIdList.flatMap((seed) => familyMemberNames(seed, names)))];
	}

	function startFamilyJob(action: 'start' | 'stop'): void {
		const ids = familyIdsFromChecked();
		if (!ids.length) return;
		void startPluginJob(leaseBoard?.plugin ?? 'localberth', action, ids, action === 'start' ? 'Start family' : 'Stop family');
	}

	function startArchive(ids: string[], restore: boolean): void {
		if (!ids.length) return;
		const parkIds = restore
			? []
			: [
					...new Set(
						ids.flatMap((id) =>
							familyMemberNames(
								id,
								(leaseBoardAll?.rows ?? []).map((row) => row.id),
							),
						),
					),
				];
		offerConfirm({
			title: restore ? 'Restore on Today?' : 'Hide on Today?',
			hint: restore
				? 'Puts these fleet rows back on Today. Folder was never moved. Does not unpark.'
				: 'Hides on Today. Folder and port stay. Matching leases can be parked on the slip (port stays).',
			items: [
				...ids.map((id) => (restore ? `restore ${id}` : `hide ${id}`)),
				...parkIds.map((id) => `park ${id} — port stays`),
			],
			confirmLabel: restore ? 'Restore' : parkIds.length ? 'Hide and park' : 'Hide',
			canApply: true,
			run: () => void applyArchive(ids, restore, parkIds),
		});
	}

	async function applyArchive(ids: string[], restore: boolean, parkIds: string[]): Promise<void> {
		const verb = restore ? 'restoring' : 'hiding';
		await run(bulkProgressLabel(verb, 1, ids.length, ids[0]), async () => {
			const data = (await call('/api/archive', {
				method: 'POST',
				body: JSON.stringify({ ids, restore }),
			})) as { ids?: string[] };
			archivedIds = Array.isArray(data.ids) ? data.ids : [];
			note(restore ? `restore ${ids.join(', ')}` : `archive ${ids.join(', ')}`, data);
			if (parkIds.length && leaseBoardAll) {
				await applyPluginItems(leaseBoardAll.plugin, 'park', parkIds);
			}
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
		await run(paths.length === 1 ? 'enrolling' : `enrolling ${paths.length} projects`, async () => {
			const plan = await call('/api/enroll', {
				method: 'POST',
				body: JSON.stringify({ paths, apply: true }),
			});
			note(`enrolled ${paths.length} project(s)`, plan);
			selectedScan = {};
			candidates = [];
			addOpen = false;
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
		await run(ids.length === 1 ? 'removing from fleet' : `removing ${ids.length} from fleet`, async () => {
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
				for (let i = 0; i < jobs.length; i++) {
					const job = jobs[i];
					if (!job) continue;
					busy = bulkProgressLabel('planning bump', i + 1, jobs.length, job.id);
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
						? 'Writes package.json and commits that file. Other dirty files stay local. No tag, no push, no publish. Each row uses its own patch/minor/major.'
						: plans[0]?.reason ?? 'cannot bump',
					items: plans.map((plan) =>
						plan.action === 'bump' && plan.to
							? plan.commit === 'commit'
								? `${plan.id}  ${plan.from ?? '?'} → ${plan.to}\n${plan.commitMessage}`
								: `${plan.id}  ${plan.from ?? '?'} → ${plan.to}\nno commit — ${plan.commitReason ?? 'skipped'}`
							: `${plan.id}  ${plan.reason ?? 'skipped'}`,
					),
					confirmLabel: can.length === 1 ? `Bump and commit ${can[0]?.to}` : `Bump and commit ${can.length}`,
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
		await run(bulkProgressLabel('bumping', 1, jobs.length, jobs[0]?.id), async () => {
			for (let i = 0; i < jobs.length; i++) {
				const job = jobs[i];
				if (!job) continue;
				busy = bulkProgressLabel('bumping', i + 1, jobs.length, job.id);
				const plan = (await call('/api/bump', {
					method: 'POST',
					body: JSON.stringify({ id: job.id, kind: job.kind, apply: true }),
				})) as BumpPlan;
				note(
					plan.commit === 'commit'
						? `bumped ${job.id} to ${plan.to} and committed`
						: `bumped ${job.id} to ${plan.to}${plan.commitReason ? ` (no commit — ${plan.commitReason})` : ''}`,
					plan,
				);
			}
			await loadStatus({ ids: jobs.map((job) => job.id) });
		});
	}

	function toggleFleetAll(on: boolean): void {
		const next = { ...selectedIds };
		for (const id of fleetIds) next[id] = on;
		selectedIds = next;
	}

	function boardActions(board: PluginBoard): { id: string; label: string; icon?: string }[] {
		const seen = new Map<string, { id: string; label: string; icon?: string }>();
		for (const row of board.rows) {
			for (const act of row.actions) {
				if (!seen.has(act.id)) seen.set(act.id, { id: act.id, label: act.label, icon: act.icon });
			}
		}
		return [...seen.values()];
	}

	function actionIcon(act: { id: string; icon?: string }): string | null {
		if (act.icon) return act.icon;
		if (act.id === 'sync') return 'lucide:refresh-cw';
		if (act.id === 'push') return 'lucide:upload';
		if (act.id === 'ship') return 'lucide:ship';
		if (act.id === 'start') return 'lucide:play';
		if (act.id === 'stop') return 'lucide:square';
		if (act.id === 'park') return 'lucide:circle-parking';
		if (act.id === 'unpark') return 'lucide:circle-parking-off';
		if (act.id === 'recipe') return 'lucide:save';
		if (act.id === 'quiet') return 'lucide:moon';
		if (act.id === 'recipe-all') return 'lucide:save';
		return null;
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

	function checkedPortIds(board: PluginBoard, action: string): string[] {
		return boardActionIds(board, action).filter((id) => selectedPorts[id]);
	}

	function portAllChecked(board: PluginBoard): boolean {
		return board.rows.length > 0 && board.rows.every((row) => selectedPorts[row.id]);
	}

	function togglePortAll(board: PluginBoard, on: boolean): void {
		const next = { ...selectedPorts };
		for (const row of board.rows) next[row.id] = on;
		selectedPorts = next;
	}

	function firstPlanReason(data: unknown): string {
		if (!data || typeof data !== 'object') return '';
		const rows = (data as { rows?: unknown }).rows;
		if (!Array.isArray(rows) || !rows[0] || typeof rows[0] !== 'object') return '';
		const reason = (rows[0] as { reason?: unknown }).reason;
		return typeof reason === 'string' ? reason : '';
	}

	function pluginJobHint(
		plugin: string,
		action: string,
		applyIds: string[],
		writeIds: string[] | null,
		data?: unknown,
	): string {
		if (!applyIds.length) {
			if (plugin === 'localberth') {
				const reason = firstPlanReason(data);
				if (reason.includes('no recipe') || reason.includes('no matching folder')) {
					return 'Start needs a folder and a command. The lease name may not match the checkout (temperpass-site → temper-pass, or dictawhisper-api → dictawhisper). No sibling matched this name.';
				}
				if (reason.includes('already listening')) return 'Already running on this lease.';
				if (reason.includes('not running')) return 'Nothing is listening on this lease.';
				if (reason.includes('park')) return 'Park hides the lease. The port stays yours. Unpark does not start.';
				if (action === 'quiet') return 'No listening *-site leases. The dashboard is left alone.';
				if (action === 'recipe-all') return 'Every lease already has a recipe, or no sibling folder matched.';
				return reason || 'Nothing to start or stop.';
			}
			return writeIds ? 'Already current — nothing to write.' : 'The plan found nothing to do.';
		}
		if (plugin === 'localberth') {
			if (action === 'stop') {
				return 'LocalBerth stops the process tree on this lease. The lease stays. Observed-only rows are not killed.';
			}
			if (action === 'park') {
				return 'Stops if we started it, then hides the lease. The port stays yours. Not a release.';
			}
			if (action === 'unpark') {
				return 'Shows the lease again. Does not start it.';
			}
			if (action === 'recipe' || action === 'recipe-all') {
				return 'Saves the guessed folder and command. Does not start.';
			}
			if (action === 'quiet') {
				return 'Stops listening *-site leases. The dashboard stays up. Not a release.';
			}
			const rows = data && typeof data === 'object' ? (data as { rows?: unknown }).rows : null;
			const first = Array.isArray(rows) && rows[0] && typeof rows[0] === 'object' ? (rows[0] as Record<string, unknown>) : null;
			if (typeof first?.proposedCwd === 'string') {
				return 'No recipe stored yet. Confirm saves this guess (folder + command) and starts. You can change it later with localberth recipe.';
			}
			return 'LocalBerth starts the lease recipe (default pnpm serve) detached. Closing LocalHelm does not stop it.';
		}
		if (action === 'push') {
			return 'git push origin <branch> only. Never --force. Never the IngotVault backup remote.';
		}
		return 'The plugin runs this in each listed checkout. LocalHelm does not reimplement it.';
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
					run: () => void applyPull(eligible.map((row) => row.id)),
				});
			},
			{ closeConfirm: false },
		);
	}

	async function applyPull(ids: string[]): Promise<void> {
		await run(bulkProgressLabel('pulling', 1, ids.length, ids[0]), async () => {
			const rows: GitRow[] = [];
			await eachNamed('pulling', ids, async (id) => {
				const data = (await call('/api/pull', {
					method: 'POST',
					body: JSON.stringify({ apply: true, ids: [id] }),
				})) as { rows: GitRow[] };
				rows.push(...data.rows);
			});
			const eligible = rows.filter((r) => r.action === 'pull');
			note(`pull --apply — ${eligible.length} repo(s) fast-forwarded`, { rows });
			await loadStatus({ ids });
		});
	}

	function pushItems(rows: GitRow[]): string[] {
		return rows.map((row) => {
			const n = row.ahead ?? '?';
			return `${row.id}  ${row.branch ?? '?'}  ${n} commit(s)\n→  ${row.origin ?? ''}`;
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
						? 'git push origin only. Never --force. Never the IngotVault backup remote. Uncommitted files stay in the working tree.'
						: onlyIds?.length === 1
							? `${onlyIds[0]}: ${data.rows[0]?.reason ?? 'cannot push'}`
							: 'Nothing is eligible: repos must be ahead of origin and not diverged.',
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
		await run(bulkProgressLabel('pushing', 1, ids.length, ids[0]), async () => {
			const rows: GitRow[] = [];
			await eachNamed('pushing', ids, async (id) => {
				const data = (await call('/api/push', {
					method: 'POST',
					body: JSON.stringify({ apply: true, ids: [id] }),
				})) as { rows: GitRow[] };
				rows.push(...data.rows);
			});
			const eligible = rows.filter((r) => r.action === 'push');
			const failed = eligible.filter((r) => r.reason !== 'pushed');
			const ok = eligible.length - failed.length;
			note(
				failed.length
					? `push --apply — ${ok} pushed, ${failed.length} failed: ${failed.map((r) => `${r.id}: ${r.reason ?? 'push failed'}`).join(' · ')}`
					: `push --apply — ${ok} pushed`,
				{ rows },
			);
			await loadStatus({ ids });
			if (failed.length) {
				error = failed.map((r) => `${r.id}: ${r.reason ?? 'push failed'}`).join(' · ');
			}
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
				publishAuthHint = data.authHint ?? '';
				if (data.npmUser) {
					npmUser = data.npmUser;
					persistNpmUser(data.npmUser);
				} else if (data.authHint) {
					npmUser = null;
				}
				const eligible = data.rows.filter((r) => r.action === 'publish');
				const cuttingNew = eligible.some((row) => row.steps.some((step) => step.kind === 'bump'));
				note(`publish plan — ${eligible.length} of ${data.rows.length} eligible, nothing written`, data);
				const cutNote = cuttingNew
					? 'The current local version is already on npm. Confirming cuts a new version.'
					: '';
				offerConfirm({
					title: eligible.length === 1
						? cuttingNew
							? `Cut and publish ${eligible[0]?.npm ?? eligible[0]?.id}@${eligible[0]?.version}?`
							: `Publish ${eligible[0]?.npm ?? eligible[0]?.id}@${eligible[0]?.version}?`
						: eligible.length
							? `Publish ${eligible.length} packages?`
							: 'Nothing to publish',
					hint: eligible.length
						? [publishAuthHint, cutNote].filter(Boolean).join(' ')
						: ids.length === 1
							? `${ids[0]}: ${data.rows[0]?.reason ?? 'cannot publish'}`
							: 'No listed package is ready to publish.',
					items: eligible.length ? eligible.flatMap(publishItems) : data.rows.map((row) => `${row.id}  ${row.reason ?? 'skipped'}`),
					confirmLabel: eligible.length === 1 ? `Publish ${eligible[0]?.version}` : `Publish ${eligible.length}`,
					variant: 'danger',
					canApply: eligible.length > 0,
					showOtp: eligible.length > 0,
					run: () => void applyPublish(eligible.map((row) => row.id)),
				});
			},
			{ closeConfirm: false },
		);
	}

	async function applyPublish(ids: string[]): Promise<void> {
		await run(bulkProgressLabel('publishing', 1, ids.length, ids[0]), async () => {
			const rows: PublishRow[] = [];
			const otp = publishOtp.trim() ? publishOtp.trim() : undefined;
			await eachNamed('publishing', ids, async (id) => {
				const data = (await call('/api/publish', {
					method: 'POST',
					body: JSON.stringify({
						apply: true,
						ids: [id],
						kind: bumpKind[id] ?? 'patch',
						otp,
					}),
				})) as { rows: PublishRow[] };
				rows.push(...data.rows);
			});
			const published = rows.filter((r) => r.reason?.startsWith('published ')).length;
			note(`publish --apply — ${published} published`, { rows });
			publishOtp = '';
			await loadStatus({ ids });
		});
	}

	async function startPluginJob(plugin: string, action: string, ids: string[], label: string): Promise<void> {
		if (ids.length === 0) return;
		const unit = plugin === 'localberth' ? 'lease' : 'site';
		const scope = ids.length === 1 ? ids[0] : `${ids.length} ${unit}s`;
		await run(
			ids.length === 1 ? `planning ${action} ${ids[0]}` : `planning ${action} for ${ids.length} ${unit}s`,
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
						? `${label} for ${applyIds.length === 1 ? applyIds[0] : `${applyIds.length} ${unit}s`}?`
						: `Nothing to ${label.toLowerCase()}`,
					hint: pluginJobHint(plugin, action, applyIds, writeIds, data),
					items: items.length ? items : ['Nothing to do.'],
					confirmLabel: applyIds.length === 1 ? label : `${label} ${applyIds.length}`,
					canApply: applyIds.length > 0,
					run: () => void applyPluginJob(plugin, action, applyIds),
				});
			},
			{ closeConfirm: false },
		);
	}

	async function applyPluginItems(plugin: string, action: string, ids: string[]): Promise<void> {
		const verb = `${plugin} ${action}`;
		await eachNamed(verb, ids, async (id) => {
			const data = await call('/api/plugin', {
				method: 'POST',
				body: JSON.stringify({ id: plugin, action, ids: [id], apply: true }),
			});
			note(`${verb} --apply ${id}`, data);
		});
	}

	async function applyPluginJob(plugin: string, action: string, ids: string[]): Promise<void> {
		await run(bulkProgressLabel(`${plugin} ${action}`, 1, ids.length, ids[0]), async () => {
			try {
				await applyPluginItems(plugin, action, ids);
			} finally {
				await loadPluginBoards();
			}
		});
	}

	async function startLand(siteId: string): Promise<void> {
		await run(
			`planning land ${siteId}`,
			async () => {
				const data = (await call('/api/land', {
					method: 'POST',
					body: JSON.stringify({ apply: false, siteId }),
				})) as {
					plan: {
						siteId: string;
						companionId: string | null;
						engineId: string;
						steps: { kind: string; label: string }[];
						needsPublish: boolean;
						note: string;
					};
					npmUser?: string | null;
					authHint?: string;
				};
				publishAuthHint = data.authHint ?? '';
				if (data.npmUser) {
					npmUser = data.npmUser;
					persistNpmUser(data.npmUser);
				}
				const steps = data.plan.steps;
				note(`land plan ${siteId} — ${steps.length} step(s), nothing written`, data);
				const companion = data.plan.companionId ? ` Companion package: ${data.plan.companionId}.` : ' No matching fleet package.';
				offerConfirm({
					title: steps.length ? `Land ${siteId}?` : `Nothing to land for ${siteId}`,
					hint: steps.length
						? `${data.plan.note}${companion}${data.plan.needsPublish && publishAuthHint ? ` ${publishAuthHint}` : ''}`
						: data.plan.note,
					items: steps.length
						? steps.map((step, i) => `${i + 1}. ${step.label}`)
						: ['Already current.'],
					confirmLabel: steps.length ? `Land ${siteId}` : 'Land',
					variant: data.plan.needsPublish ? 'danger' : 'write',
					canApply: steps.length > 0,
					showOtp: data.plan.needsPublish,
					run: () => void applyLand(siteId),
				});
			},
			{ closeConfirm: false },
		);
	}

	async function applyLand(siteId: string): Promise<void> {
		await run(`landing ${siteId}`, async () => {
			const data = (await call('/api/land', {
				method: 'POST',
				body: JSON.stringify({
					apply: true,
					siteId,
					otp: publishOtp.trim() ? publishOtp.trim() : undefined,
				}),
			})) as {
				result: {
					ok: boolean;
					stoppedAt?: string;
					steps: { ok: boolean; label: string; reason: string }[];
				};
			};
			const ok = data.result.steps.filter((s) => s.ok).length;
			const failed = data.result.steps.filter((s) => !s.ok);
			note(
				data.result.ok
					? `land --apply ${siteId} — ${ok} step(s) ok`
					: `land --apply ${siteId} — stopped: ${data.result.stoppedAt ?? failed[0]?.label ?? 'failed'}`,
				data,
			);
			publishOtp = '';
			await loadPluginBoards();
			await loadStatus({ ids: [siteId] });
			if (!data.result.ok) {
				error = failed.map((s) => `${s.label}: ${s.reason}`).join(' · ') || data.result.stoppedAt || 'land failed';
			}
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
			})) as { to: string; npm: string; rows: { action: string; writes?: boolean; fromId: string }[]; note: string };
			note(`cascade ${data.npm}@${data.to} — wrote ${data.rows.filter((r) => r.writes).length} pin(s)`, data);
			const wrote = data.rows.filter((row) => row.writes).map((row) => row.fromId);
			await loadStatus({ ids: [...new Set([id, ...wrote])] });
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

	function gitSummary(row: Project): string {
		if (row.missing) return 'folder missing';
		if (!row.git.repo) return 'not a git repo';
		if (row.git.error) return plainGitError(row.git.error);
		const parts = [row.git.branch ?? 'detached', row.git.dirty ? 'dirty' : 'clean'];
		if (!row.git.origin) parts.push('no origin');
		else if (!row.git.ahead && !row.git.behind) parts.push('in sync');
		return parts.join(' · ');
	}

	function todayBadges(row: Project): Badge[] {
		return badges(row).filter((badge) => {
			if (badge.text === 'nothing to do') return false;
			if (canPush(row) && badge.text.endsWith(' to push')) return false;
			return true;
		});
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
			const blocked = whyNotPublish(row);
			out.push({
				text: row.npm.latest ? `unpublished ${row.localVersion} (npm ${row.npm.latest})` : `never published ${row.localVersion}`,
				tone: 'ship',
				title: blocked
					? `Local version is ahead of npm, but publish is blocked (${blocked}). Commit or stash leftover files, or fix origin/upstream, then publish.`
					: 'Local version is ahead of npm. Publish will push if needed, then npm publish.',
			});
		}
		if ((row.git.ahead ?? 0) > 0) {
			const blocked = whyNotPush(row.git);
			out.push({
				text: `${row.git.ahead} to push`,
				tone: blocked ? 'warn' : 'ship',
				title: blocked
					? `Local commits look ahead, but push is blocked (${blocked}).`
					: 'This branch is ahead of origin. Push the commits. Uncommitted files stay local.',
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

	type NeedAction = { id: 'publish' | 'push' | 'pins'; label: string; title: string; run: () => void };

	function needActions(row: Project): NeedAction[] {
		const acts: NeedAction[] = [];
		if (row.unpublishedAhead && canPublish(row)) {
			acts.push({
				id: 'publish',
				label: `Publish ${row.localVersion ?? ''}`.trim(),
				title: 'Shows bump, push, and npm publish. Confirm in the modal. Never --force.',
				run: () => startPublish([row.id]),
			});
		}
		if ((row.git.ahead ?? 0) > 0 && canPush(row)) {
			acts.push({
				id: 'push',
				label: `Push ${row.git.ahead}`,
				title: 'Shows the origin URL and commit count. Confirm in the modal. Never --force.',
				run: () => startPush([row.id]),
			});
		}
		if ((cascadeFor(row.id)?.writable ?? 0) > 0) {
			acts.push({
				id: 'pins',
				label: 'Write pins',
				title: 'Shows which dependents would get the new pin. Confirm in the modal.',
				run: () => startCascade(row.id),
			});
		}
		return acts;
	}

	function leftoverBadges(row: Project): Badge[] {
		const acts = needActions(row);
		return badges(row).filter((badge) => {
			if (badge.text === 'nothing to do') return acts.length === 0;
			if (acts.some((act) => act.id === 'publish') && badge.text.includes('unpublished')) return false;
			if (acts.some((act) => act.id === 'push') && badge.text.includes('to push')) return false;
			if (acts.some((act) => act.id === 'pins') && badge.text.includes('pin')) return false;
			return true;
		});
	}

	function siteBoardHelp(board: PluginBoard): string {
		const bits = [board.note ?? ''];
		if (board.plugin === 'filepress') {
			bits.push(
				'Site names can match a fleet package and still be a different checkout.',
				'Engine is the locked getfilepress version. Sync engine <version> appears only when that site is behind or headers need a merge.',
				'Land does needed engine/package writes, then Sync → Push → Ship for the site.',
				'Push is git push origin <branch> only — never --force.',
			);
		}
		bits.push('Check rows, then run a job on the selection.');
		return bits.filter(Boolean).join('\n\n');
	}

	function familyChipTip(family: { bits: string; members: { id: string }[] }): string {
		const ids = family.members.map((member) => member.id).join(', ');
		return `Checks ${ids}. Then use Start family or Stop family.\n${family.bits}`;
	}

	onMount(() => {
		const params = new URLSearchParams(window.location.search);
		restoreUrlState(params);
		try {
			const savedNpm = sessionStorage.getItem('localhelm.npmUser');
			if (savedNpm) npmUser = savedNpm;
		} catch {
			/* ignore */
		}
		urlSyncReady = true;
		void loadActivity();
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
					{:else if statusReady}
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
					<span class="group-label">Read</span>
					<div class="group-buttons">
						<button class="btn" disabled={Boolean(busy)} onclick={() => refresh()} title="Re-read every enrolled project, plus Sites and Ports. For one row, use the refresh icon on that row.">
							<Icon icon="lucide:refresh-cw" />
							Refresh
						</button>
						<button
							class="btn"
							disabled={!statusReady}
							onclick={() => void copyBrief()}
							title="Copies a markdown brief of Today, Ports, and recent activity."
						>
							<Icon icon="lucide:clipboard" />
							{briefCopied ? 'Copied brief' : 'Copy brief'}
						</button>
						<button
							class="btn"
							disabled={Boolean(busy)}
							onclick={() => refresh(true)}
							title="git fetch origin in each repo, then re-read. Updates the to push / to pull counts."
						>
							<Icon icon="lucide:cloud-download" />
							Fetch remotes
						</button>
					</div>
				</div>

				<div class="group group-write">
					<span class="group-label">Write — confirm first</span>
					<div class="group-buttons">
						<button
							class="btn btn-write"
							disabled={Boolean(busy)}
							onclick={() => startPull()}
							title="Shows which clean, behind repos would fast-forward. Confirm in the modal to pull."
						>
							<Icon icon="lucide:git-pull-request" />
							Pull
						</button>
						<button
							class="btn btn-write"
							disabled={Boolean(busy)}
							onclick={() => startPush()}
							title="Shows which clean, ahead repos would push to origin. Confirm in the modal. Never --force."
						>
							<Icon icon="lucide:upload" />
							Push
						</button>
						<button
							class="btn btn-write"
							disabled={Boolean(busy)}
							onclick={() => startExport()}
							title="Shows the inventory JSON path. Confirm in the modal to write it."
						>
							<Icon icon="lucide:file-json" />
							Write JSON
						</button>
					</div>
				</div>
				<IconButton
					icon="lucide:scroll-text"
					label={activityOpen ? 'Close activity log' : 'Open activity log'}
					title="Activity — every plan and write"
					pressed={activityOpen}
					hot={activityUnseen}
					badge={activityUnseen ? 'new' : entries.length || ''}
					onclick={() => setActivityOpen(!activityOpen)}
				/>
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
				{#if npmUser}
					<span class="chip quiet" title="npm whoami">npm {npmUser}</span>
				{:else if statusReady}
					<span class="chip" title="Run localhelm auth and put a granular automation token in your user ~/.npmrc">npm not signed in</span>
				{/if}
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
			<Icon icon="lucide:sun" />
			Today
			{#if todayCount > 0}<span class="count">{todayCount}</span>{/if}
		</button>
		<button type="button" class="tab" class:active={tab === 'fleet'} onclick={() => setTab('fleet')}>
			<Icon icon="lucide:ship" />
			Fleet
			{#if inventory}<span class="count quiet">{inventory.digest.projects}</span>{/if}
		</button>
		<button type="button" class="tab" class:active={tab === 'sites'} onclick={() => setTab('sites')}>
			<Icon icon="lucide:globe" />
			Sites
			{#if filepressBoard}<span class="count quiet">{filepressBoard.rows.length}</span>{/if}
		</button>
		<button type="button" class="tab" class:active={tab === 'ports'} class:hot={portsNeedingYou.length > 0} onclick={() => setTab('ports')}>
			<Icon icon="lucide:anchor" />
			Ports
			{#if leaseBoard}<span class="count quiet">{leaseBoard.rows.length}</span>{/if}
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
							{#if statusReady}
							<p class="hint">
								{#if readyRows.length}
									{readyRows.length} unpublished-ahead. Gold button is the matching write.
								{:else}
									Gold button is the matching write. Cut version is the extra.
								{/if}
							</p>
							{/if}
						</div>
						<div class="group-buttons">
							<button
								class="btn"
								disabled={!statusReady}
								onclick={() => void copyBrief()}
								title="Copies a markdown brief of needs-you, Ports, and recent activity."
							>
								<Icon icon="lucide:clipboard" />
								{briefCopied ? 'Copied brief' : 'Copy brief'}
							</button>
							{#if unpublishedPublishIds.length > 0}
								<button
									class="btn btn-write"
									disabled={Boolean(busy)}
									onclick={() => startPublish(unpublishedPublishIds)}
									title="Shows bump, push, and npm publish for unpublished-ahead packages the plan would actually publish."
								>
									<Icon icon="lucide:package-up" />
									Publish unpublished
								</button>
							{/if}
						</div>
					</div>

					{#if statusReady && attentionRows.length === 0 && cascadeOnlyRows.length === 0 && portLookCards.length === 0}
						<p class="quiet-banner">All quiet on the fleet. Open Fleet for the full table, Sites for FilePress, or Ports for leases.</p>
					{:else if statusReady && (attentionRows.length > 0 || cascadeOnlyRows.length > 0)}
						<ul class="need-list">
							{#each attentionRows as row (row.id)}
								{@const cascadeTarget = cascadeFor(row.id)}
								{@const need = todayNeed(row)}
								<li class="need-card">
									<div class="need-main">
										<div class="id">{row.id}</div>
										<div class="dim small">
											{row.npm.name ?? row.path} · {gitSummary(row)}
											{#if cascadeTarget}
												· dependents {cascadeTarget.behind ? `${cascadeTarget.behind} behind` : ''}{cascadeTarget.behind && cascadeTarget.linked ? ', ' : ''}{cascadeTarget.linked ? `${cascadeTarget.linked} local link` : ''}
											{/if}
										</div>
									</div>
									<div class="badges">
										{#each todayBadges(row) as badge (badge.text)}
											<span class={`badge ${badge.tone}`} title={badge.title ?? ''}>{badge.text}</span>
										{/each}
									</div>
									<div class="need-actions">
										<IconButton
											compact
											icon="lucide:refresh-cw"
											label={`Refresh ${row.id}`}
											title="Re-read this row only."
											disabled={Boolean(busy)}
											onclick={() => void refreshRows([row.id])}
										/>
										{#if need === 'publish'}
											<button
												class="btn btn-sm btn-write"
												disabled={Boolean(busy)}
												onclick={() => startPublish([row.id])}
												title="Shows bump, push, and npm publish steps. Confirm in the modal."
											>
												Publish
											</button>
										{:else if need === 'push'}
											<button
												class="btn btn-sm btn-write"
												disabled={Boolean(busy)}
												onclick={() => startPush([row.id])}
												title="Shows the origin URL and commit count. Confirm in the modal. Never --force."
											>
												Push{row.git.ahead ? ` ${row.git.ahead}` : ''}
											</button>
										{:else if need === 'pins' && cascadeTarget}
											<button
												class="btn btn-sm btn-write"
												disabled={Boolean(busy)}
												onclick={() => startCascade(row.id)}
												title="Shows which dependents would get the new pin. Confirm in the modal to write."
											>
												Write pins
											</button>
										{/if}
										{#if need !== 'publish' && canPublish(row)}
											<button
												class="btn btn-sm"
												disabled={Boolean(busy)}
												onclick={() => startPublish([row.id])}
												title="Cuts a patch if local already matches npm, then publishes. Confirm in the modal. Use Fleet to pick minor or major."
											>
												Cut version
											</button>
										{/if}
										{#if need !== 'push' && canPush(row)}
											<button
												class="btn btn-sm"
												disabled={Boolean(busy)}
												onclick={() => startPush([row.id])}
												title="Shows the origin URL and commit count. Confirm in the modal. Never --force."
											>
												Push{row.git.ahead ? ` ${row.git.ahead}` : ''}
											</button>
										{/if}
										{#if need !== 'pins' && cascadeTarget && cascadeTarget.writable > 0}
											<button
												class="btn btn-sm"
												disabled={Boolean(busy)}
												onclick={() => startCascade(row.id)}
												title="Shows which dependents would get the new pin. Confirm in the modal to write."
											>
												Write pins
											</button>
										{/if}
									</div>
								</li>
							{/each}
							{#each cascadeOnlyRows as target (target.id)}
								<li class="need-card">
									<div class="need-main">
										<div class="id">{target.id}</div>
										<div class="dim small">
											{target.npm}{target.latest ? `@${target.latest}` : ''} is published — dependents still need the pin
										</div>
									</div>
									<div class="badges">
										{#if target.behind}<span class="badge warn">{target.behind} pin(s) behind</span>{/if}
										{#if target.linked}<span class="badge info">{target.linked} local link</span>{/if}
									</div>
									<div class="need-actions">
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
					{#if statusReady && portLookCards.length}
						<div class="looks-block">
							<h3 class="looks-head">Looks</h3>
							<p class="hint">Facts, not writes. Folder and port stay put.</p>
							<ul class="need-list">
								{#each portLookCards as look (look.id)}
									<li class="need-card">
										<div class="need-main">
											<div class="id">{look.title}</div>
											<Tooltip wide title={look.detail}>
												<div class="dim small">{look.detail}</div>
											</Tooltip>
											<CrossChips
												chips={chipsFor(look.title)}
												onOpen={(kind) => openCross(look.title, kind)}
											/>
										</div>
										<div class="need-actions">
											<button
												type="button"
												class="btn btn-sm"
												onclick={() => openPortsFamily(look.leaseIds)}
												title="Opens Ports with these leases checked."
											>
												Open Ports
											</button>
										</div>
									</li>
								{/each}
							</ul>
						</div>
					{/if}
				</section>

				{#if statusReady}
				<div class="today-side">
				<section class="panel">
					<div class="section-head">
						<div>
							<h2>FilePress sites</h2>
							<p class="hint">Content sites, not npm packages.</p>
						</div>
						<button type="button" class="btn btn-sm" onclick={() => setTab('sites')}><Icon icon="lucide:arrow-right" /> Open Sites</button>
					</div>
					{#if !filepressBoard}
						<p class="dim small">No FilePress plugin loaded. Enroll the filepress checkout to see sites here.</p>
					{:else}
						<p class="dim small">
							{filepressBoard.rows.length} sites
							{#if sitesNeedingYou.length}
								· {sitesNeedingYou.length} need an engine sync or header merge
							{:else}
								· none waiting on an engine sync
							{/if}
						</p>
						{#if filepressSyncIds.length}
							<div class="group-buttons">
								<button
									class="btn btn-write"
									disabled={Boolean(busy)}
									onclick={() => startPluginJob(filepressBoard.plugin, 'sync', filepressSyncIds, 'Sync engine')}
									title="Shows which FilePress sites need an engine sync. Confirm in the modal to write."
								>
									<Icon icon="lucide:refresh-cw" />
									Sync engine
								</button>
							</div>
						{/if}
						{#if sitesNeedingYou.length}
							<ul class="need-list compact">
								{#each sitesNeedingYou.slice(0, 8) as site (site.id)}
									<li class="need-card">
										<div class="need-main">
											<div class="id">{site.id}</div>
											{#if enrolledIds.has(site.id)}
												<div class="dim small">FilePress site — not the fleet package</div>
											{/if}
											<div class="dim small">{siteNeedReason(site.cells)}</div>
										</div>
										<div class="need-actions">
											<button
												class="btn btn-sm btn-write"
												disabled={Boolean(busy)}
												onclick={() => startLand(site.id)}
												title="Plans engine package, matching fleet package, then Sync → Push → Ship for this site. Confirm in the modal."
											>
												<Icon icon="lucide:plane-landing" />
												Land
											</button>
										</div>
									</li>
								{/each}
							</ul>
							{#if sitesNeedingYou.length > 8}
								<p class="dim small">{sitesNeedingYou.length - 8} more on the Sites tab.</p>
							{/if}
						{/if}
					{/if}
				</section>
				<section class="panel">
					<div class="section-head">
						<div>
							<h2>Ports</h2>
							<p class="hint">Named LocalBerth leases.</p>
						</div>
						<button type="button" class="btn btn-sm" onclick={() => setTab('ports')}><Icon icon="lucide:arrow-right" /> Open Ports</button>
					</div>
					{#if !leaseBoard}
						<p class="dim small">No Ports plugin loaded. Enroll the localberth checkout to see leases here.</p>
					{:else}
						<p class="dim small">
							{leaseBoard.rows.length} lease{leaseBoard.rows.length === 1 ? '' : 's'}
							{#if portFamilyCards.length}
								· {portFamilyCards.length} stack{portFamilyCards.length === 1 ? '' : 's'}
							{/if}
							{#if portsNeedingYou.length}
								· {portsNeedingYou.length} down, conflicted, or need a firewall
							{:else}
								· all listening
							{/if}
						</p>
						<div class="ports-snapshot">
							{#if portFamilyCards.length}
								<div>
									<h3 class="looks-head">Stacks</h3>
									<p class="hint">One line per family. Open checks those leases on Ports.</p>
									<ul class="need-list">
										{#each portFamilyCards.slice(0, 8) as family (family.stem)}
											<li class="need-card">
												<div class="need-main">
													<div class="id">{family.label}</div>
													<div class="dim small">{family.bits}</div>
												</div>
												<div class="need-actions">
													<button
														type="button"
														class="btn btn-sm"
														onclick={() => openPortsFamily(family.leaseIds)}
														title="Opens Ports with this stack checked."
													>
														Open
													</button>
												</div>
											</li>
										{/each}
									</ul>
									{#if portFamilyCards.length > 8}
										<p class="dim small">{portFamilyCards.length - 8} more on the Ports tab.</p>
									{/if}
								</div>
							{/if}
							{#if portsNeedingYou.length}
								<div>
									<h3 class="looks-head">Down or conflicted</h3>
									<p class="hint">Single leases that are down, conflicted, or need a firewall.</p>
									<ul class="need-list">
										{#each portsNeedingYou.slice(0, 8) as row (row.id)}
											<li class="need-card">
												<div class="id">{row.label ?? row.id}</div>
												<div class="dim small">
													{row.cells.port ?? '—'}
													· {row.cells.listening === 'no' ? 'not listening' : row.cells.conflict === 'yes' ? 'conflict' : row.cells.firewall}
												</div>
											</li>
										{/each}
									</ul>
									{#if portsNeedingYou.length > 8}
										<p class="dim small">{portsNeedingYou.length - 8} more on the Ports tab.</p>
									{/if}
								</div>
							{/if}
						</div>
					{/if}
				</section>
				</div>
				{/if}
			</div>
		{:else if tab === 'fleet'}
			<div class="fleet-layout">
				<section class="panel">
					<div class="section-head">
						<div>
							<h2>Fleet</h2>
							<p class="hint">Needs you is the write for that row. The refresh icon re-reads that row only. Check rows for bulk refresh, bump, push, publish, or remove. Removing never deletes a folder. Bump writes package.json and commits that file.</p>
						</div>
						<div class="group-buttons">
							<button
								class="btn"
								disabled={Boolean(busy) || !checkedIds.length}
								onclick={() => void refreshRows(checkedIds)}
								title="Re-read package.json, git, and npm for the checked rows only. Does not fetch remotes or reload Sites/Ports."
							>
								<Icon icon="lucide:refresh-cw" />
								Refresh{checkedIds.length ? ` (${checkedIds.length})` : ''}
							</button>
							<button
								class="btn"
								disabled={Boolean(busy)}
								onclick={() => (addOpen = true)}
								title="Scan a folder and pick which projects to enroll."
							>
								<Icon icon="lucide:folder-plus" />
								Add projects
							</button>
							<button
								class="btn btn-write"
								disabled={Boolean(busy) || !checkedIds.length}
								onclick={() => startBump(checkedIds)}
								title="Shows the next version, then writes package.json and commits that file. No tag, no push, no publish."
							>
								<Icon icon="lucide:chevrons-up" />
								Bump{checkedIds.length ? ` (${checkedIds.length})` : ''}
							</button>
							<button
								class="btn btn-write"
								disabled={Boolean(busy) || !checkedIds.length}
								onclick={() => startPush(checkedIds)}
								title="Shows which checked repos would push to origin. Confirm in the modal. Never --force."
							>
								<Icon icon="lucide:upload" />
								Push{checkedIds.length ? ` (${checkedIds.length})` : ''}
							</button>
							<button
								class="btn btn-write"
								disabled={Boolean(busy) || !checkedPublishIds.length}
								onclick={() => startPublish(checkedPublishIds)}
								title="Shows bump, push, and npm publish for the checked public packages. Confirm in the modal."
							>
								<Icon icon="lucide:package-up" />
								Publish{checkedPublishIds.length ? ` (${checkedPublishIds.length})` : ''}
							</button>
							<button
								class="btn btn-write"
								disabled={Boolean(busy) || !checkedIds.length}
								onclick={() => startUnenroll()}
								title="Shows which fleet rows would be removed. Confirm in the modal. Never deletes a folder."
							>
								<Icon icon="lucide:folder-minus" />
								Remove{checkedIds.length ? ` (${checkedIds.length})` : ''}
							</button>
							<button
								class="btn"
								disabled={Boolean(busy) || !checkedIds.length}
								onclick={() => startArchive(checkedIds, showArchived)}
								title={showArchived ? 'Puts checked rows back on Today. Folder was never moved.' : 'Hides checked rows on Today. Folder and port stay.'}
							>
								<Icon icon={showArchived ? 'lucide:archive-restore' : 'lucide:archive'} />
								{showArchived ? 'Restore' : 'Archive'}{checkedIds.length ? ` (${checkedIds.length})` : ''}
							</button>
							{#if archivedIds.length}
								<button
									type="button"
									class="btn"
									onclick={() => (showArchived = !showArchived)}
									title="Archived rows stay enrolled. This only changes what Today and Fleet show."
								>
									{showArchived ? 'Hide archived' : `Archived (${archivedIds.length})`}
								</button>
							{/if}
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
								{#each visibleProjects as row (row.id)}
									<tr>
										<td class="tick"><input type="checkbox" aria-label={`select ${row.id}`} bind:checked={selectedIds[row.id]} /></td>
										<td>
											<div class="project-cell">
												<span class="id">{row.id}</span>
												<span class="dim small">{row.npm.name ?? row.path}</span>
												<CrossChips compact chips={chipsFor(row.id, 'fleet')} onOpen={(kind) => openCross(row.id, kind)} />
												<IconButton
													compact
													icon="lucide:refresh-cw"
													label={`Refresh ${row.id}`}
													title="Re-read this row (package.json, git, npm). Does not fetch remotes or reload Sites/Ports."
													disabled={Boolean(busy)}
													onclick={() => void refreshRows([row.id])}
												/>
												<IconButton
													compact
													icon="lucide:clipboard"
													label={`Copy path for ${row.id}`}
													title={copiedKey === `path:${row.id}` ? 'Copied' : `Copy path\n${row.path}`}
													onclick={() => void copyValue(`path:${row.id}`, row.path)}
												/>
											</div>
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
											<div class="need-cell">
												{#each needActions(row) as act (act.id)}
													<Tooltip title={act.title}>
														<button
															type="button"
															class="btn btn-sm btn-write"
															disabled={Boolean(busy)}
															onclick={act.run}
														>
															{act.label}
														</button>
													</Tooltip>
												{/each}
												{#each leftoverBadges(row) as badge (badge.text)}
													<Tooltip title={badge.title ?? badge.text}>
														<span class={`badge ${badge.tone}`}>{badge.text}</span>
													</Tooltip>
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
													title="Shows the next version, then writes package.json and commits that file. No tag, no push, no publish."
												>
													Bump
												</button>
											</div>
										</td>
									</tr>
								{/each}
								{#if !inventory?.projects.length}
									<tr><td class="empty" colspan="8">Nothing enrolled yet. Open Add projects, scan a folder, tick the ones you ship, then write.</td></tr>
								{/if}
							</tbody>
						</table>
					</div>

					<p class="legend">
						Check rows for bulk bump, push, publish, or remove. Each write button plans first, then asks you to confirm. Cancel leaves disk unchanged.
						Publish bumps if local is already on npm, pushes if needed, then <code>npm publish</code>. Never <code>--force</code>. Never the IngotVault backup remote.
					</p>
				</section>
			</div>
		{:else if tab === 'sites'}
			{#each siteBoards as board (board.plugin + board.title)}
				{@const siteCols = siteTableColumns(board.plugin, board.columns)}
				<section class="panel plugin-board">
					<div class="section-head">
						<div>
							<h2>{board.title}</h2>
							<InfoHint
								summary={board.plugin === 'filepress'
									? 'Content sites. Check rows, then Sync, Push, or Ship.'
									: 'Check rows, then run a job on the selection.'}
								detail={siteBoardHelp(board)}
							/>
						</div>
						<div class="group-buttons">
							{#each boardActions(board) as act (act.id)}
								{@const icon = actionIcon(act)}
								<button
									class="btn btn-write"
									disabled={Boolean(busy) || checkedSiteIds(board, act.id).length === 0}
									onclick={() => startPluginJob(board.plugin, act.id, checkedSiteIds(board, act.id), act.label)}
									title={`Shows what ${act.label.toLowerCase()} would do for the checked sites. Confirm in the modal.`}
								>
									{#if icon}<Icon {icon} />{/if}
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
									<th>{board.rowLabel ?? 'site'}</th>
									{#each siteCols as col (col.id)}
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
										<td>
											<div class="project-cell">
												<span class="id">{row.label ?? row.id}</span>
												<CrossChips compact chips={chipsFor(row.id, 'sites')} onOpen={(kind) => openCross(row.id, kind)} />
											</div>
										</td>
										{#each siteCols as col (col.id)}
											<td class="small" class:mono={col.id === 'engine'}>{siteCellValue(col.id, row.cells)}</td>
										{/each}
										<td>
											<div class="bump">
												{#if board.plugin === 'filepress'}
													<button
														class="btn btn-sm btn-write"
														disabled={Boolean(busy)}
														onclick={() => startLand(row.id)}
														title="Plans engine package, matching fleet package, then Sync → Push → Ship for this site. Confirm in the modal."
													>
														<Icon icon="lucide:plane-landing" />
														Land
													</button>
												{/if}
												{#if board.plugin === 'filepress' && siteNeedsEngineSync(row.cells)}
													<button
														class="btn btn-sm btn-write"
														disabled={Boolean(busy)}
														onclick={() => startPluginJob(board.plugin, 'sync', [row.id], siteSyncLabel(row.cells))}
														title="Retargets getfilepress and merges headers if needed. Confirm in the modal."
													>
														<Icon icon="lucide:refresh-cw" />
														{siteSyncLabel(row.cells)}
													</button>
												{/if}
												{#each row.actions.filter((act) => board.plugin !== 'filepress' || act.id !== 'sync') as act (act.id)}
													{@const icon = actionIcon(act)}
													<button
														class="btn btn-sm"
														disabled={Boolean(busy)}
														onclick={() => startPluginJob(board.plugin, act.id, [row.id], act.label)}
														title={`Shows what ${act.label.toLowerCase()} would do. Confirm in the modal.`}
													>
														{#if icon}<Icon {icon} />{/if}
														{act.label}
													</button>
												{/each}
											</div>
										</td>
									</tr>
								{/each}
								{#if !board.rows.length}
									<tr><td class="empty" colspan={siteCols.length + 3}>No rows from this plugin.</td></tr>
								{/if}
							</tbody>
						</table>
					</div>
				</section>
			{:else}
				<section class="panel">
					<h2>Sites</h2>
					{#if !statusReady}
						<p class="hint">Reading sites…</p>
					{:else}
						<p class="hint">No site plugins loaded. Enroll the filepress checkout to expose <code>localhelm.plugin.mjs</code>.</p>
					{/if}
				</section>
			{/each}
		{:else if tab === 'ports'}
			{#if !statusReady && !portBoards.length}
				<section class="panel">
					<h2>Ports</h2>
					<p class="hint">Reading ports…</p>
				</section>
			{:else if !portBoards.length}
				<section class="panel">
					<h2>Ports</h2>
					<p class="hint">No Ports plugin loaded. Enroll the localberth checkout to expose <code>localhelm.plugin.mjs</code>.</p>
				</section>
			{:else}
				<div class="subtabs" role="tablist" aria-label="Port views">
					<button
						type="button"
						role="tab"
						id="tab-leases"
						aria-controls="pane-ports"
						aria-selected={portPane === 'leases'}
						class:active={portPane === 'leases'}
						onclick={() => setPortPane('leases')}
					>
						Leases
						{#if leaseBoard}<span class="count quiet">{leaseBoard.rows.length}</span>{/if}
					</button>
					<button
						type="button"
						role="tab"
						id="tab-observed"
						aria-controls="pane-ports"
						aria-selected={portPane === 'observed'}
						class:active={portPane === 'observed'}
						onclick={() => setPortPane('observed')}
					>
						Observed
						{#if observedBoard}<span class="count quiet">{observedBoard.rows.length}</span>{/if}
					</button>
				</div>
				{#if visiblePortBoard}
					{@const board = visiblePortBoard}
					{@const leaseActions = portPane === 'leases'}
					<section class="panel plugin-board" id="pane-ports" role="tabpanel" aria-labelledby={portPane === 'observed' ? 'tab-observed' : 'tab-leases'}>
						<div class="section-head">
							<div>
								<h2>{board.title}</h2>
								<InfoHint
									summary={leaseActions
										? 'Named leases. Start and Stop run the recipe detached. Click a stack to check that family.'
										: 'Observed listeners only. Claim and release stay on the localberth CLI.'}
									detail={board.note}
								/>
							</div>
							{#if leaseActions}
								<div class="group-buttons">
									<Tooltip title="Stops every listening *-site lease. The dashboard stays up. Confirm lists names.">
										<button
											class="btn btn-write"
											disabled={Boolean(busy) || !quietSiteIds.length}
											onclick={() => startPluginJob(board.plugin, 'quiet', quietSiteIds, 'Quiet sites')}
										>
											<Icon icon="lucide:moon" />
											Quiet sites{quietSiteIds.length ? ` (${quietSiteIds.length})` : ''}
										</button>
									</Tooltip>
									<Tooltip title="Saves a guessed folder and command for every lease that has none. Does not start.">
										<button
											class="btn btn-write"
											disabled={Boolean(busy) || !guessRecipeIds.length}
											onclick={() => startPluginJob(board.plugin, 'recipe-all', guessRecipeIds, 'Save all guesses')}
										>
											<Icon icon="lucide:save" />
											Save all guesses{guessRecipeIds.length ? ` (${guessRecipeIds.length})` : ''}
										</button>
									</Tooltip>
									<Tooltip title="Plans start for every unparked lease in the checked families.">
										<button
											class="btn btn-write"
											disabled={Boolean(busy) || !familyIdsFromChecked().length}
											onclick={() => startFamilyJob('start')}
										>
											<Icon icon="lucide:play" />
											Start family
										</button>
									</Tooltip>
									<Tooltip title="Plans stop for every unparked lease in the checked families.">
										<button
											class="btn btn-write"
											disabled={Boolean(busy) || !familyIdsFromChecked().length}
											onclick={() => startFamilyJob('stop')}
										>
											<Icon icon="lucide:square" />
											Stop family
										</button>
									</Tooltip>
									{#if parkedLeaseCount}
										<button
											type="button"
											class="btn"
											onclick={() => (showParked = !showParked)}
											title="Parked leases keep their port. Unpark does not start them."
										>
											{showParked ? 'Hide parked' : `Parked (${parkedLeaseCount})`}
										</button>
									{/if}
									{#each boardActions(board) as act (act.id)}
										{@const icon = actionIcon(act)}
										<button
											class="btn btn-write"
											disabled={Boolean(busy) || checkedPortIds(board, act.id).length === 0}
											onclick={() => startPluginJob(board.plugin, act.id, checkedPortIds(board, act.id), act.label)}
											title={`Shows what ${act.label.toLowerCase()} would do for the checked leases. Confirm in the modal.`}
										>
											{#if icon}<Icon {icon} />{/if}
											{act.label}{checkedPortIds(board, act.id).length ? ` (${checkedPortIds(board, act.id).length})` : ''}
										</button>
									{/each}
								</div>
							{/if}
						</div>
						{#if leaseActions && portFamilyCards.length}
							<div class="family-block">
								<h3 class="looks-head">Stacks</h3>
								<p class="hint">Click a stack to check those leases, then Start family or Stop family.</p>
								<ul class="family-strip">
									{#each portFamilyCards as family (family.stem)}
										<li>
											<Tooltip wide title={familyChipTip(family)}>
												<button type="button" class="family-chip" onclick={() => openPortsFamily(family.leaseIds)}>
													<span class="id">{family.label}</span>
													<span class="dim small">{family.bits}</span>
												</button>
											</Tooltip>
										</li>
									{/each}
								</ul>
							</div>
						{/if}
						<div class="table-wrap">
							<table>
								<thead>
									<tr>
										{#if leaseActions}
											<th class="tick">
												<input
													type="checkbox"
													aria-label={`Select all ${board.title} rows`}
													checked={portAllChecked(board)}
													indeterminate={board.rows.some((row) => selectedPorts[row.id]) && !portAllChecked(board)}
													onchange={(event) => togglePortAll(board, event.currentTarget.checked)}
												/>
											</th>
										{/if}
										<th>{board.rowLabel ?? 'name'}</th>
										{#each board.columns as col (col.id)}
											<th>{col.label}</th>
										{/each}
										<th></th>
									</tr>
								</thead>
								<tbody>
									{#each board.rows as row (row.id)}
										<tr>
											{#if leaseActions}
												<td class="tick">
													<input type="checkbox" aria-label={`select ${row.id}`} bind:checked={selectedPorts[row.id]} />
												</td>
											{/if}
											<td class="id">
												{row.label ?? row.id}
												<CrossChips chips={chipsFor(row.id, 'ports')} onOpen={(kind) => openCross(row.id, kind)} />
											</td>
											{#each board.columns as col (col.id)}
												<td class="small">
													{#if col.id === 'health' || col.id === 'recipe'}
														<Tooltip wide title={healthTip(row)}>{row.cells[col.id] ?? '—'}</Tooltip>
													{:else}
														{row.cells[col.id] ?? '—'}
													{/if}
												</td>
											{/each}
											<td>
												<div class="port-actions">
													{#if row.href}
														<Tooltip title={`Open ${row.href}`}>
															<a
																class="open-link"
																href={row.href}
																target="localberth-open"
																rel="noopener"
																aria-label={`Open ${row.label ?? row.id}`}
															>
																<Icon icon="lucide:square-arrow-out-up-right" />
															</a>
														</Tooltip>
														<Tooltip title={copiedKey === `url:${row.id}` ? 'Copied' : `Copy ${row.href}`}>
															<button type="button" class="btn btn-sm" onclick={() => void copyValue(`url:${row.id}`, row.href ?? '')}>
																Copy
															</button>
														</Tooltip>
													{:else}
														<span class="open-slot" aria-hidden="true"></span>
													{/if}
													{#if leaseActions}
														{#each row.actions as act (act.id)}
															{@const icon = actionIcon(act)}
															<Tooltip title={`Shows what ${act.label.toLowerCase()} would do. Confirm in the modal.`}>
																<button
																	class="btn btn-sm"
																	disabled={Boolean(busy)}
																	onclick={() => startPluginJob(board.plugin, act.id, [row.id], act.label)}
																>
																	{#if icon}<Icon {icon} />{/if}
																	{act.label}
																</button>
															</Tooltip>
														{/each}
													{/if}
												</div>
											</td>
										</tr>
									{/each}
									{#if !board.rows.length}
										<tr><td class="empty" colspan={board.columns.length + (leaseActions ? 3 : 2)}>Nothing here.</td></tr>
									{/if}
								</tbody>
							</table>
						</div>
					</section>
				{/if}
				<p class="dim small port-cli">
					<code>localberth recipe name --cwd PATH</code>
					·
					<code>localberth start name</code>
					·
					<code>localberth stop name</code>
					·
					<code>localberth claim name --port N</code>
				</p>
			{/if}
		{/if}
	</main>

	{#if activityOpen}
		<button type="button" class="drawer-backdrop" aria-label="Close activity" onclick={() => setActivityOpen(false)}></button>
		<aside class="drawer" aria-label="Activity">
			<div class="section-head">
				<div>
					<h2><Icon icon="lucide:scroll-text" /> Activity</h2>
					<p class="hint">Every plan and write, newest first. Kept in this workspace so a refresh does not wipe it.</p>
				</div>
				<div class="group-buttons">
					{#if entries.length}
						<button class="btn btn-sm" disabled={Boolean(busy)} onclick={() => void clearActivityLog()}>
							<Icon icon="lucide:trash-2" />
							Clear
						</button>
					{/if}
					<IconButton icon="lucide:x" label="Close activity" onclick={() => setActivityOpen(false)} />
				</div>
			</div>
			{#if entries.length === 0}
				<p class="dim small">Nothing yet.</p>
			{:else}
				<ul class="log">
					{#each entries as entry (entry.at + entry.title)}
						<li>
							<details>
								<summary>
									<span class="dim small">{entry.time}</span>
									{entry.title}
									{#each activityLinkedIds(entry.title, knownIds) as id (id)}
										<button
											type="button"
											class="xchip"
											onclick={(event) => {
												event.preventDefault();
												event.stopPropagation();
												activityJump(id);
											}}
										>{id}</button>
									{/each}
								</summary>
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
		if (event.key === 'Escape' && activityOpen && !confirmOpen && !addOpen) setActivityOpen(false);
	}}
/>

<AddProjectsModal bind:open={addOpen} busy={Boolean(busy)}>
	<label for="scan-root">Folder to scan</label>
	<div class="row">
		<input id="scan-root" bind:value={scanRoot} spellcheck="false" />
		<button class="btn" disabled={Boolean(busy)} onclick={() => scan()}><Icon icon="lucide:search" /> Scan</button>
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
				<Icon icon="lucide:folder-plus" />
				Add to fleet{checkedScan.length ? ` (${checkedScan.length})` : ''}
			</button>
		</div>
	{:else}
		<p class="dim small">Scan a folder to see candidates. Already enrolled rows stay in the list as disabled.</p>
	{/if}
</AddProjectsModal>

<ConfirmModal
	bind:open={confirmOpen}
	title={confirmTitle}
	hint={confirmHint}
	confirmLabel={confirmLabel}
	variant={confirmVariant}
	busy={Boolean(busy)}
	busyLabel={busy}
	canApply={confirmCanApply}
	items={confirmItems}
	onconfirm={() => {
		const fn = confirmRun;
		confirmRun = null;
		fn?.();
	}}
>
	{#if confirmShowOtp}
		<p class="dim small">
			{#if npmUser}
				npm is logged in as <code>{npmUser}</code>.
			{:else}
				npm is not ready. Run <code>localhelm auth</code> and put a granular automation token in your user <code>~/.npmrc</code>.
			{/if}
		</p>
		<label for="publish-otp">Authenticator OTP only if npm asks for a numeric code</label>
		<input id="publish-otp" bind:value={publishOtp} autocomplete="one-time-code" spellcheck="false" placeholder="optional" />
	{/if}
</ConfirmModal>

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
		padding: 0.75rem 1.5rem 0.7rem;
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
		display: inline-flex;
		align-items: center;
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
		color: #c4c4cc;
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
		align-items: flex-end;
		gap: 1rem;
	}

	h2 :global(.icon) {
		margin-right: 0.35rem;
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
		display: inline-flex;
		align-items: center;
		gap: 0.35rem;
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
		margin-top: 0.55rem;
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
		border-color: #c9a227;
		background: #4a3a12;
		color: #fde68a;
	}

	.tab .count {
		font-size: 0.7rem;
		border: 1px solid #8b8b93;
		background: #3a3a42;
		border-radius: 999px;
		padding: 0 0.4rem;
		color: #f4f4f5;
	}

	.tab .count.quiet {
		color: #f4f4f5;
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

	.today-side {
		display: grid;
		gap: 1rem;
	}

	.port-actions {
		display: flex;
		flex-wrap: nowrap;
		justify-content: flex-end;
		align-items: center;
		gap: 0.25rem;
		white-space: nowrap;
	}

	.open-link,
	.open-link:visited {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 2.15rem;
		height: 2.15rem;
		border: 1px solid #c9a227;
		background: #4a3a12;
		color: #fde68a;
		border-radius: 0.45rem;
		font-size: 1.05rem;
		text-decoration: none;
	}

	.open-link :global(svg) {
		color: inherit;
		stroke: currentColor;
	}

	.open-link:hover {
		border-color: #e4c04a;
		background: #5a4818;
		color: #fff3b0;
	}

	.open-slot {
		display: block;
		width: 2.15rem;
		height: 2.15rem;
	}

	.port-cli {
		margin: 0.25rem 0 0;
	}

	.subtabs {
		display: flex;
		flex-shrink: 0;
		gap: 0.25rem;
	}

	.subtabs button {
		border: none;
		border-bottom: 2px solid transparent;
		background: transparent;
		color: var(--muted, #6b6b74);
		padding: 0.35rem 0.7rem;
		font-size: 0.88rem;
		cursor: pointer;
		display: inline-flex;
		align-items: center;
		gap: 0.4rem;
	}

	.subtabs button:hover {
		color: inherit;
	}

	.subtabs button.active {
		border-bottom-color: var(--accent, #3d6b4f);
		color: inherit;
		font-weight: 600;
	}

	.subtabs .count {
		font-size: 0.7rem;
		border: 1px solid #8b8b93;
		background: #3a3a42;
		border-radius: 999px;
		padding: 0 0.4rem;
		color: #f4f4f5;
	}

	@media (min-width: 1100px) {
		.today-grid {
			grid-template-columns: minmax(0, 1.35fr) minmax(20rem, 0.85fr);
			align-items: start;
		}

		.fleet-layout {
			grid-template-columns: minmax(0, 1fr);
		}
	}

	.section-head {
		display: flex;
		flex-wrap: wrap;
		align-items: flex-start;
		justify-content: space-between;
		gap: 0.6rem;
		margin-bottom: 0.6rem;
	}

	.section-head > :first-child {
		flex: 1 1 14rem;
		min-width: 0;
	}

	.section-head .group-buttons {
		flex: 0 1 auto;
		justify-content: flex-end;
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

	.project-cell {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.2rem 0.45rem;
	}

	.project-cell .id {
		margin: 0;
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
		padding: 0.45rem 0.7rem;
		border-radius: 0.45rem;
		margin: 0.35rem 0 0;
		font-size: 0.8rem;
	}

	.need-list {
		list-style: none;
		margin: 0.45rem 0 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 0.35rem;
	}

	.need-list.compact {
		max-height: 18rem;
		overflow: auto;
	}

	.ports-snapshot {
		display: flex;
		flex-direction: column;
		gap: 0.9rem;
		margin-top: 0.45rem;
	}

	.looks-block {
		margin-top: 1.15rem;
		padding-top: 1rem;
		border-top: 1px solid #3d3d44;
	}

	.looks-head {
		margin: 0 0 0.2rem;
		font-size: 1rem;
	}

	.family-block {
		margin: 0 0 0.85rem;
	}

	.family-block .hint {
		margin: 0 0 0.4rem;
	}

	.family-strip {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-wrap: wrap;
		gap: 0.45rem;
	}

	.family-chip {
		border: 1px solid #4c4c54;
		background: #2c2c32;
		color: inherit;
		border-radius: 0.45rem;
		padding: 0.35rem 0.65rem;
		display: grid;
		gap: 0.1rem;
		text-align: left;
		cursor: pointer;
	}

	.family-chip:hover {
		border-color: #6b6b74;
		background: #333338;
	}

	.need-card {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.4rem 0.65rem;
		background: #3d3d46;
		border: 1px solid #585860;
		border-radius: 0.45rem;
		padding: 0.4rem 0.55rem;
	}

	.need-main {
		min-width: 11rem;
		flex: 1 1 11rem;
	}

	.need-card .badges {
		flex: 0 1 auto;
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

	.bump,
	.need-actions,
	.need-cell {
		display: flex;
		flex-wrap: wrap;
		gap: 0.25rem;
		align-items: center;
	}

	.need-actions {
		margin-left: auto;
	}

	.need-actions:empty {
		display: none;
	}

	.candidates,
	.xchip {
		margin-left: 0.35rem;
		padding: 0.05rem 0.4rem;
		border: 1px solid #5a5a64;
		border-radius: 999px;
		background: #32323a;
		color: #d4d4d8;
		font: inherit;
		font-size: 0.68rem;
		cursor: pointer;
	}

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

	.candidates {
		max-height: min(28rem, 50dvh);
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
