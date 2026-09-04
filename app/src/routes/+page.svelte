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
	import { formatPluginPlanLines, pluginPlanLineKeys, pluginPlanWriteIds } from '$lib/pluginPlan';
	import { formatBrief } from '$lib/briefFormat';
	import { familyMemberNames } from '$lib/family';
	import { portFamilies, portLooks, type PortFamily } from '$lib/looks';
	import {
		canCutVersion,
		commitCountLabel,
		fleetWriteIds,
		fleetWriteLabel,
		isGithubPublishReason,
		isPublishedReason,
		nextCutVersion,
		plainGitError,
		publishApplyTitle,
		publishResultLine,
		landPluginApplyOk,
		whyNotPublish,
		whyNotPush,
		writableCascadeCount,
		type FleetWriteId,
	} from '$lib/writeGate';
	import { bulkProgressLabel } from '$lib/bulkProgress';
	import { plainFetchError } from '$lib/fetchError';
	import { applyConfirmStep, emptyConfirmPhases, markConfirmKey, publishNeedsGithub, publishNeedsNpm, publishStepLabel, type ConfirmPhase } from '$lib/confirmProgress';
	import { landConfirmItems } from '$lib/landDisplay';
	import { fleetProjectMeta, fleetVersionLabel, headerNeedChips } from '$lib/fleetDisplay';
	import PortFilterBar from '$lib/PortFilterBar.svelte';
	import { portCellValue, portTableColumns } from '$lib/portDisplay';
	import { rowMatchesPortFilters, type PortBoardFilters } from '$lib/portFilters';
	import HelmMenu from '$lib/HelmMenu.svelte';
	import { pluginCellLinks, pluginRowNote, pluginRowOpenHref, siteCellValue, siteLocalHref, siteNeedsEngineSync, sitePluginJobVisible, siteSyncLabel, siteTableColumns } from '$lib/siteDisplay';
	import {
		canonicalizeTab,
		isCoreTab,
		isPortsPluginTab,
		parseDashboardTab,
		pluginTabCount,
		pluginTabIcon,
		pluginTabMetas,
		type PluginTabMeta,
	} from '$lib/dashboardTabs';
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
			links?: Record<string, string>;
			linkGroups?: Record<string, { label: string; href?: string }[]>;
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
		commitsSinceNpm?: number | null;
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
	type PortPane = 'leases' | 'stacks' | 'observed';
	type NeedFilter = 'all' | 'publish' | 'cut' | 'push';

	let inventory = $state<Inventory | null>(null);
	let tab = $state('today');
	let portPane = $state<PortPane>('leases');
	let needFilter = $state<NeedFilter>('all');
	let activityOpen = $state(false);
	let activityUnseen = $state(false);
	let urlSyncReady = $state(false);
	let cwd = $state('');
	let host = $state<string | null>(null);
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
	let leaseFilters = $state<PortBoardFilters>({});
	let observedFilters = $state<PortBoardFilters>({});
	let bumpKind = $state<Record<string, BumpKind>>({});

	type PluginCatalogItem = PluginTabMeta & { source?: string; enabled: boolean };
	let pluginBoards = $state<PluginBoard[]>([]);
	let pluginMetas = $state<PluginCatalogItem[]>([]);
	let publishOtp = $state('');
	let npmUser = $state<string | null>(null);
	let publishAuthHint = $state('');
	let confirmOpen = $state(false);
	let confirmTitle = $state('');
	let confirmHint = $state('');
	let confirmLabel = $state('Confirm');
	let confirmVariant = $state<'write' | 'danger'>('write');
	let confirmItems = $state<string[]>([]);
	let confirmItemKeys = $state<string[]>([]);
	let confirmPhases = $state<ConfirmPhase[]>([]);
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
		(inventory?.projects ?? [])
			.filter((row) => showArchived || !archivedSet.has(row.id))
			.toSorted((a, b) => a.id.localeCompare(b.id, undefined, { sensitivity: 'base' })),
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
	const serveLine = $derived.by(() => {
		if (!port) return '';
		const where =
			host && host !== '0.0.0.0' && host !== '::'
				? `serving ${host}:${port}`
				: `serving :${port} on all interfaces`;
		const lease =
			portSource === 'localslip'
				? ' (port leased from LocalSlip)'
				: portSource === 'flag'
					? ' (--port)'
					: '';
		return `${where}${lease}`;
	});
	const needChips = $derived(inventory ? headerNeedChips(inventory.digest) : []);
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
	const pluginTabs = $derived(pluginTabMetas(pluginMetas, pluginBoards));
	const siteBoards = $derived(pluginBoards.filter((board) => board.plugin === canonicalizeTab(tab) && !isPortsPluginTab(tab)));
	const portBoards = $derived(pluginBoards.filter((board) => board.plugin === 'localslip' || board.tab === 'ports'));
	const filepressBoard = $derived(pluginBoards.find((board) => board.plugin === 'filepress') ?? null);
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
	const leaseViewRows = $derived(
		(leaseBoard?.rows ?? []).filter((row) => rowMatchesPortFilters(row.cells, leaseFilters, 'leases')),
	);
	const observedViewRows = $derived(
		(observedBoard?.rows ?? []).filter((row) => rowMatchesPortFilters(row.cells, observedFilters, 'observed')),
	);
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
	const filteredAttentionRows = $derived(attentionRows.filter((row) => rowHasNeed(row, needFilter)));
	const filteredCascadeRows = $derived(needFilter === 'all' ? cascadeOnlyRows : []);
	const needFilterCounts = $derived({
		all: attentionRows.length + cascadeOnlyRows.length,
		publish: attentionRows.filter((row) => rowHasNeed(row, 'publish')).length,
		cut: attentionRows.filter((row) => rowHasNeed(row, 'cut')).length,
		push: attentionRows.filter((row) => rowHasNeed(row, 'push')).length,
	});
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
	const checkedPushIds = $derived(checkedIds.filter((id) => {
		const row = inventory?.projects.find((p) => p.id === id);
		return row ? !whyNotPush(row.git) : false;
	}));
	const unpublishedPublishIds = $derived(
		shipRows.filter((row) => row.unpublishedAhead && !whyNotPublish(row)).map((row) => row.id),
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

	function parseTab(raw: string | null): string | null {
		return parseDashboardTab(raw);
	}

	function parsePortPane(raw: string | null): PortPane | null {
		if (raw === 'leases' || raw === 'stacks' || raw === 'observed') return raw;
		return null;
	}

	function parseNeedFilter(raw: string | null): NeedFilter | null {
		if (raw === 'all' || raw === 'publish' || raw === 'cut' || raw === 'push') return raw;
		return null;
	}

	function rowHasNeed(row: Project, filter: NeedFilter): boolean {
		if (filter === 'all') return true;
		if (filter === 'publish') return Boolean(row.unpublishedAhead && canPublish(row));
		if (filter === 'cut') return canCutVersion(row);
		return canPush(row);
	}

	function setTab(next: string): void {
		tab = canonicalizeTab(next);
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
		const needParam = parseNeedFilter(params.get('need'));
		if (needParam) needFilter = needParam;
	}

	$effect(() => {
		if (!urlSyncReady) return;
		const params = new URLSearchParams(typeof window !== 'undefined' ? window.location.search : '');
		if (tab === 'today') params.delete('tab');
		else params.set('tab', canonicalizeTab(tab));
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

		if (needFilter === 'all') params.delete('need');
		else params.set('need', needFilter);

		const next = params.toString();
		const current = typeof window !== 'undefined' ? window.location.search.slice(1) : '';
		if (next !== current) {
			replaceState(next ? `?${next}` : window.location.pathname, {});
		}
	});

	function rowNeedsYou(row: Project): boolean {
		return badges(row).some((badge) => badge.text !== 'nothing to do') || writesFor(row).length > 0;
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

	function writesFor(row: Project): FleetWriteId[] {
		return fleetWriteIds(row, cascadeFor(row.id)?.writable ?? 0);
	}

	async function call(url: string, init?: RequestInit): Promise<unknown> {
		let res: Response;
		try {
			res = await fetch(url, {
				...init,
				headers: { 'content-type': 'application/json', ...(init?.headers ?? {}) },
			});
		} catch (err) {
			throw new Error(plainFetchError(err));
		}
		let data: { error?: string };
		try {
			data = (await res.json()) as { error?: string };
		} catch {
			throw new Error(
				res.ok
					? 'Dashboard returned a non-JSON response.'
					: `Dashboard request failed (${res.status} ${res.statusText}).`,
			);
		}
		if (!res.ok) throw new Error(data.error ?? res.statusText);
		return data;
	}

	async function callNdjson(
		url: string,
		init: RequestInit,
		onEvent: (event: Record<string, unknown>) => void,
	): Promise<unknown> {
		let res: Response;
		try {
			res = await fetch(url, {
				...init,
				headers: { 'content-type': 'application/json', ...(init?.headers ?? {}) },
			});
		} catch (err) {
			throw new Error(plainFetchError(err));
		}
		const kind = res.headers.get('content-type') ?? '';
		if (!kind.includes('ndjson')) {
			let data: { error?: string };
			try {
				data = (await res.json()) as { error?: string };
			} catch {
				throw new Error(
					res.ok
						? 'Dashboard returned a non-JSON response.'
						: `Dashboard request failed (${res.status} ${res.statusText}).`,
				);
			}
			if (!res.ok) throw new Error(data.error ?? res.statusText);
			return data;
		}
		if (!res.body) throw new Error('Dashboard returned an empty progress stream.');
		const reader = res.body.getReader();
		const dec = new TextDecoder();
		let buf = '';
		let result: unknown;
		const take = (line: string): void => {
			const trimmed = line.trim();
			if (!trimmed) return;
			const event = JSON.parse(trimmed) as Record<string, unknown>;
			if (event.type === 'error') throw new Error(String(event.error ?? 'Publish failed.'));
			if (event.type === 'result') result = event;
			else onEvent(event);
		};
		while (true) {
			const { done, value } = await reader.read();
			if (done) break;
			buf += dec.decode(value, { stream: true });
			const lines = buf.split('\n');
			buf = lines.pop() ?? '';
			for (const line of lines) take(line);
		}
		if (buf.trim()) take(buf);
		return result ?? {};
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
			if (confirmItemKeys.includes(name)) {
				confirmPhases = markConfirmKey(confirmItemKeys, confirmPhases, name, 'current');
			}
			try {
				await fn(name);
				if (confirmItemKeys.includes(name)) {
					confirmPhases = markConfirmKey(confirmItemKeys, confirmPhases, name, 'done');
				}
			} catch (err) {
				if (confirmItemKeys.includes(name)) {
					confirmPhases = markConfirmKey(confirmItemKeys, confirmPhases, name, 'fail');
				}
				throw err;
			}
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

	function applyPluginDashboard(plug: {
		boards: PluginBoard[];
		plugins?: { id: string; label: string; source?: string; enabled?: boolean }[];
	}): void {
		pluginMetas = (plug.plugins ?? []).map((item) => ({
			id: item.id,
			label: item.label,
			source: item.source,
			enabled: item.enabled !== false,
		}));
		pluginBoards = plug.boards;
		if (!isCoreTab(tab) && pluginMetas.some((item) => item.id === canonicalizeTab(tab) && !item.enabled)) {
			setTab('today');
		}
	}

	async function loadPluginBoards(): Promise<void> {
		try {
			applyPluginDashboard((await call('/api/plugins')) as {
				boards: PluginBoard[];
				plugins?: { id: string; label: string; source?: string; enabled?: boolean }[];
			});
		} catch {
			/* keep the last boards */
		}
	}

	async function setPluginOn(id: string, enabled: boolean): Promise<void> {
		pluginMetas = pluginMetas.map((item) => (item.id === id ? { ...item, enabled } : item));
		if (!enabled && canonicalizeTab(tab) === id) setTab('today');
		try {
			applyPluginDashboard((await call('/api/plugins', {
				method: 'POST',
				body: JSON.stringify({ id, enabled }),
			})) as {
				boards: PluginBoard[];
				plugins?: { id: string; label: string; source?: string; enabled?: boolean }[];
			});
			note(`${id} ${enabled ? 'on' : 'off'}`, { id, enabled });
		} catch (err) {
			error = err instanceof Error ? err.message : String(err);
			await loadPluginBoards();
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
			host?: string | null;
			port: string | null;
			portSource: string | null;
			npmUser?: string | null;
		};
		if (scoped && inventory && data.inventory) inventory = mergeInventory(inventory, data.inventory);
		else inventory = data.inventory;
		cwd = data.cwd;
		host = data.host ?? null;
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
		itemKeys?: string[];
		confirmLabel: string;
		variant?: 'write' | 'danger';
		canApply: boolean;
		showOtp?: boolean;
		run?: () => void;
	}): void {
		confirmTitle = spec.title;
		confirmHint = spec.hint;
		confirmItems = spec.items;
		confirmItemKeys = spec.itemKeys ?? spec.items.map((_, i) => String(i));
		confirmPhases = emptyConfirmPhases(spec.items.length);
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

	function checkPortsFamily(ids: string[]): void {
		selectedPorts = idsToSelection(ids);
	}

	function openPortsFamily(ids: string[]): void {
		checkPortsFamily(ids);
		portPane = 'leases';
		setTab('localslip');
	}

	function openPortsStacks(): void {
		portPane = 'stacks';
		setTab('localslip');
	}

	function familyJobIds(seeds: string[]): string[] {
		const names = (leaseBoard?.rows ?? []).map((row) => row.id);
		return [...new Set(seeds.flatMap((seed) => familyMemberNames(seed, names)))];
	}

	function stackCanStart(family: PortFamily): boolean {
		return family.members.some((member) => member.hasLease && member.listening === false);
	}

	function stackCanStop(family: PortFamily): boolean {
		return family.members.some((member) => member.hasLease && member.listening === true);
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
			setTab('filepress');
			return;
		}
		openPortsFamily([id]);
	}

	function activityJump(id: string): void {
		if (leaseIds.includes(id)) {
			openPortsFamily([id]);
			return;
		}
		const pluginHit = pluginBoards.find((board) => board.rows.some((row) => row.id === id));
		if (pluginHit) {
			if (pluginHit.plugin === 'localslip' || pluginHit.tab === 'ports') {
				openPortsFamily([id]);
				return;
			}
			selectedSites = { ...selectedSites, [id]: true };
			setTab(pluginHit.plugin);
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
		return familyJobIds(checkedPortIdList);
	}

	function startFamilyJob(action: 'start' | 'stop', seeds?: string[]): void {
		const ids = seeds?.length ? familyJobIds(seeds) : familyIdsFromChecked();
		if (!ids.length) return;
		void startPluginJob(leaseBoard?.plugin ?? 'localslip', action, ids, action === 'start' ? 'Start family' : 'Stop family');
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
		return [...seen.values()].filter((act) => sitePluginJobVisible(board.plugin, act.id));
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

	function portAllChecked(rows: { id: string }[]): boolean {
		return rows.length > 0 && rows.every((row) => selectedPorts[row.id]);
	}

	function togglePortAll(rows: { id: string }[], on: boolean): void {
		const next = { ...selectedPorts };
		for (const row of rows) next[row.id] = on;
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
			if (plugin === 'localslip') {
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
		if (plugin === 'localslip') {
			if (action === 'stop') {
				return 'LocalSlip stops the process tree on this lease. The lease stays. Observed-only rows are not killed.';
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
				return 'No recipe stored yet. Confirm saves this guess (folder + command) and starts. You can change it later with localslip recipe.';
			}
			return 'LocalSlip starts the lease recipe (default pnpm serve) detached. Closing LocalHelm does not stop it.';
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
					itemKeys: eligible.map((row) => row.id),
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
			if (row.action !== 'push') {
				return `${row.id}  ${row.reason ?? 'skipped'}`;
			}
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
				const named = Boolean(onlyIds?.length);
				const listed = named ? data.rows : eligible;
				note(`push plan — ${eligible.length} of ${data.rows.length} eligible (origin only), nothing written`, data);
				const skipNote =
					named && listed.length > eligible.length
						? `${eligible.length} of ${listed.length} checked can push. Click a name to see why the others stay local. `
						: '';
				offerConfirm({
					title: eligible.length === 1 ? `Push ${eligible[0]?.id} to origin?` : eligible.length ? 'Push these branches to origin?' : 'Nothing to push',
					hint: eligible.length
						? `${skipNote}git push origin only. Never --force. Never the IngotVault backup remote. Uncommitted files stay in the working tree.`
						: onlyIds?.length === 1
							? `${onlyIds[0]}: ${data.rows[0]?.reason ?? 'cannot push'}`
							: named
								? 'None of the checked repos can push: they must be ahead of origin and not diverged.'
								: 'Nothing is eligible: repos must be ahead of origin and not diverged.',
					items: listed.length ? pushItems(listed) : ['Nothing to push.'],
					itemKeys: listed.map((row) => row.id),
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

	function publishItems(row: PublishRow, named: boolean): string[] {
		return row.steps.map((step, i) => {
			const line = `${i + 1}. ${publishStepLabel(step)}`;
			return named ? `${row.id}  ${line}` : line;
		});
	}

	function publishItemKeys(row: PublishRow): string[] {
		return row.steps.map((_, i) => `${row.id}:${i}`);
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
				const githubOnly = eligible.length > 0 && eligible.every((row) => publishNeedsGithub(row.steps) && !publishNeedsNpm(row.steps));
				const needsNpm = eligible.some((row) => publishNeedsNpm(row.steps));
				note(`publish plan — ${eligible.length} of ${data.rows.length} eligible, nothing written`, data);
				const cutNote = cuttingNew
					? 'The current local version is already on npm. Confirming cuts a new version.'
					: '';
				const githubNote = githubOnly
					? 'These packages publish from GitHub Actions (OIDC provenance). Confirm writes the cut, then open the Publish workflow.'
					: eligible.some((row) => publishNeedsGithub(row.steps))
						? 'Some packages publish from GitHub Actions. Confirm writes the cut; open each GitHub Publish link instead of npm here.'
						: '';
				offerConfirm({
					title: eligible.length === 1
						? cuttingNew
							? githubOnly
								? `Cut ${eligible[0]?.npm ?? eligible[0]?.id}@${eligible[0]?.version} and open GitHub?`
								: `Cut and publish ${eligible[0]?.npm ?? eligible[0]?.id}@${eligible[0]?.version}?`
							: githubOnly
								? `Open GitHub Publish for ${eligible[0]?.npm ?? eligible[0]?.id}@${eligible[0]?.version}?`
								: `Publish ${eligible[0]?.npm ?? eligible[0]?.id}@${eligible[0]?.version}?`
						: eligible.length
							? githubOnly
								? `Open GitHub Publish for ${eligible.length} packages?`
								: `Publish ${eligible.length} packages?`
							: 'Nothing to publish',
					hint: eligible.length
						? [needsNpm ? publishAuthHint : '', cutNote, githubNote].filter(Boolean).join(' ')
						: ids.length === 1
							? `${ids[0]}: ${data.rows[0]?.reason ?? 'cannot publish'}`
							: 'No listed package is ready to publish.',
					items: eligible.length
						? eligible.flatMap((row) => publishItems(row, eligible.length > 1))
						: data.rows.map((row) => `${row.id}  ${row.reason ?? 'skipped'}`),
					itemKeys: eligible.flatMap(publishItemKeys),
					confirmLabel: eligible.length === 1
						? githubOnly
							? cuttingNew
								? `Cut ${eligible[0]?.version}`
								: 'Open GitHub'
							: `Publish ${eligible[0]?.version}`
						: githubOnly
							? `Open GitHub ${eligible.length}`
							: `Publish ${eligible.length}`,
					variant: 'danger',
					canApply: eligible.length > 0,
					showOtp: needsNpm,
					run: () => void applyPublish(eligible.map((row) => row.id)),
				});
			},
			{ closeConfirm: false },
		);
	}

	function slimPublishRows(rows: PublishRow[]): unknown[] {
		return rows.map((row) => ({
			id: row.id,
			action: row.action,
			version: row.version,
			reason: row.reason,
			stderr: isPublishedReason(row.reason) ? undefined : row.stderr?.slice(0, 2500),
		}));
	}

	async function applyPublish(ids: string[]): Promise<void> {
		const rows: PublishRow[] = [];
		await run(
			bulkProgressLabel('publishing', 1, ids.length, ids[0]),
			async () => {
				const otp = publishOtp.trim() ? publishOtp.trim() : undefined;
				await eachNamed('publishing', ids, async (id) => {
					const data = (await callNdjson(
						'/api/publish',
						{
							method: 'POST',
							body: JSON.stringify({
								apply: true,
								ids: [id],
								kind: bumpKind[id] ?? 'patch',
								otp,
							}),
						},
						(event) => {
							if (event.type !== 'step') return;
							confirmPhases = applyConfirmStep(confirmItemKeys, confirmPhases, {
								id: String(event.id ?? id),
								index: Number(event.index),
								status: event.status === 'fail' || event.status === 'done' ? event.status : 'start',
							});
						},
					)) as { rows?: PublishRow[] };
					rows.push(...(data.rows ?? []));
				});
				note(publishApplyTitle(rows), { rows: slimPublishRows(rows) });
				publishOtp = '';
				await loadStatus({ ids });
			},
			{ closeConfirm: false },
		);
		if (!rows.length) {
			confirmOpen = false;
			return;
		}
		const failed = rows.filter((row) => !isPublishedReason(row.reason));
		const github = rows.filter((row) => isGithubPublishReason(row.reason));
		const npmOk = rows.filter((row) => row.reason?.startsWith('published '));
		offerConfirm({
			title: failed.length
				? failed.length === rows.length
					? 'Nothing reached npm'
					: `${failed.length} of ${rows.length} did not finish`
				: github.length && !npmOk.length
					? rows.length === 1
						? 'Open GitHub to publish'
						: `Open GitHub for ${github.length} packages`
					: rows.length === 1
						? `Published ${rows[0]?.reason?.replace(/^published /, '') ?? rows[0]?.id}`
						: `Published ${npmOk.length} packages`,
			hint: failed.length
				? 'Those packages did not finish. Fix the line below, then try those ids again.'
				: github.length && !npmOk.length
					? 'Laptop npm publish is blocked (OIDC provenance). Click the GitHub Publish link and run the workflow.'
					: github.length
						? 'Packages that reached npm are listed. Click any GitHub Publish link to run that workflow.'
						: 'All listed packages reached npm.',
			items: rows.map(publishResultLine),
			confirmLabel: 'OK',
			canApply: false,
		});
	}

	async function startPluginJob(plugin: string, action: string, ids: string[], label: string): Promise<void> {
		if (ids.length === 0) return;
		const unit = plugin === 'localslip' ? 'lease' : 'site';
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
				const lineKeys = pluginPlanLineKeys(data);
				note(`${plugin} ${action} plan ${scope}`, data);
				offerConfirm({
					title: applyIds.length
						? `${label} for ${applyIds.length === 1 ? applyIds[0] : `${applyIds.length} ${unit}s`}?`
						: `Nothing to ${label.toLowerCase()}`,
					hint: pluginJobHint(plugin, action, applyIds, writeIds, data),
					items: items.length ? items : ['Nothing to do.'],
					itemKeys: items.length && lineKeys.length === items.length ? lineKeys : undefined,
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
			const check = landPluginApplyOk(data);
			if (!check.ok) {
				error = `${id}: ${check.reason}`;
				throw new Error(error);
			}
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

	type LandPlanBody = {
		siteId: string;
		companionId: string | null;
		engineId: string;
		steps: { kind: string; label: string }[];
		needsPublish: boolean;
		needsOtp: boolean;
		note: string;
	};

	type LandPlanPayload = {
		plans?: LandPlanBody[];
		plan?: LandPlanBody;
		npmUser?: string | null;
		authHint?: string;
	};

	async function startLand(siteIds: string[]): Promise<void> {
		const ids = [...new Set(siteIds.map((id) => id.trim()).filter(Boolean))];
		if (!ids.length) return;
		await run(
			ids.length === 1 ? `planning land ${ids[0]}` : `planning land for ${ids.length} sites`,
			async () => {
				const payload = (await call('/api/land', {
					method: 'POST',
					body: JSON.stringify({ apply: false, siteIds: ids }),
				})) as LandPlanPayload;
				publishAuthHint = payload.authHint ?? '';
				if (payload.npmUser) {
					npmUser = payload.npmUser;
					persistNpmUser(payload.npmUser);
				}
				const plans = payload.plans?.length ? payload.plans : payload.plan ? [payload.plan] : [];
				const lined = landConfirmItems(plans);
				const work = plans.filter((plan) => plan.steps.length > 0);
				const needsPublish = plans.some((plan) => plan.needsPublish);
				const needsOtp = plans.some((plan) => plan.needsOtp);
				const one = plans[0];
				note(
					ids.length === 1
						? `land plan ${ids[0]} — ${one?.steps.length ?? 0} step(s), nothing written`
						: `land plan ${ids.length} sites — ${work.length} with writes, nothing written`,
					{ plans },
				);
				const extra = ids.length === 1 ? '' : ` ${work.length} of ${ids.length} need a write.`;
				offerConfirm({
					title: work.length
						? work.length === 1
							? `Land ${work[0]?.siteId}?`
							: `Land ${work.length} sites?`
						: ids.length === 1
							? `Nothing to land for ${ids[0]}`
							: 'Nothing to land',
					hint: work.length
						? `${one?.note ?? ''}${extra}${needsOtp && publishAuthHint ? ` ${publishAuthHint}` : ''}`
						: one?.note ?? 'Already current.',
					items: lined.items.length ? lined.items : ['Already current.'],
					itemKeys: lined.keys,
					confirmLabel: work.length === 1 ? `Land ${work[0]?.siteId}` : work.length ? `Land ${work.length}` : 'Land',
					variant: needsPublish ? 'danger' : 'write',
					canApply: work.length > 0,
					showOtp: needsOtp,
					run: () => void applyLand(work.map((plan) => plan.siteId)),
				});
			},
			{ closeConfirm: false },
		);
	}

	async function applyLand(siteIds: string[]): Promise<void> {
		const ids = [...new Set(siteIds.map((id) => id.trim()).filter(Boolean))];
		await run(bulkProgressLabel('landing', 1, ids.length, ids[0]), async () => {
			const otp = publishOtp.trim() ? publishOtp.trim() : undefined;
			try {
				await eachNamed('landing', ids, async (siteId) => {
					const data = (await callNdjson(
						'/api/land',
						{
							method: 'POST',
							body: JSON.stringify({ apply: true, siteId, otp }),
						},
						(event) => {
							if (event.type !== 'step') return;
							confirmPhases = applyConfirmStep(confirmItemKeys, confirmPhases, {
								id: String(event.id ?? siteId),
								index: Number(event.index),
								status: event.status === 'fail' || event.status === 'done' ? event.status : 'start',
							});
						},
					)) as {
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
					if (!data.result.ok) {
						error = failed.map((s) => `${s.label}: ${s.reason}`).join(' · ') || data.result.stoppedAt || 'land failed';
						throw new Error(error);
					}
				});
			} finally {
				publishOtp = '';
				await loadPluginBoards();
				await loadStatus({ ids });
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

	function candidateFolderLabel(row: Candidate): string {
		const rel = row.path.replace(/\\/g, '/');
		if (!rel || rel === '.') return row.absPath;
		return rel;
	}

	function todayBadges(row: Project): Badge[] {
		return badges(row).filter((badge) => {
			if (badge.text === 'nothing to do') return false;
			if (row.unpublishedAhead && (badge.text.includes('unpublished') || badge.text.includes('never published'))) return false;
			if ((row.git.ahead ?? 0) > 0 && badge.text.includes('to push')) return false;
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
				text: `${commitCountLabel(row.git.ahead) || row.git.ahead} to push`,
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

	type NeedAction = { id: FleetWriteId; label: string; title: string; run: () => void; disabled?: boolean };

	function rowBumpKind(row: Project): BumpKind {
		return bumpKind[row.id] ?? 'patch';
	}

	function needActionTitle(id: FleetWriteId, row: Project): string {
		if (id === 'publish') return 'Shows bump, push, and npm publish. Confirm in the modal. Never --force.';
		if (id === 'push') {
			const commits = commitCountLabel(row.git.ahead);
			return commits
				? `${commits} ahead of origin. Confirm in the modal. Never --force. Uncommitted files stay local.`
				: 'Shows the origin URL and commit count. Confirm in the modal. Never --force.';
		}
		if (id === 'pins') return 'Shows which dependents would get the new pin. Confirm in the modal.';
		const n = row.commitsSinceNpm ?? 0;
		const next = nextCutVersion(row, rowBumpKind(row));
		const current = row.npm.latest ?? row.localVersion ?? 'this version';
		return `Origin has ${n} commit${n === 1 ? '' : 's'} since npm ${current}. Confirm bumps to ${next ?? 'the next version'} (${rowBumpKind(row)}) and publishes. Use Fleet to pick minor or major.`;
	}

	function blockedPublishTitle(row: Project): string {
		const blocked = whyNotPublish(row);
		if (blocked === 'dirty') {
			return 'Commit or stash leftover files first. Publish skips a dirty tree so the npm tarball does not include them.';
		}
		if (blocked) return `Publish is blocked (${blocked}). Fix that, then this button turns on.`;
		return needActionTitle('publish', row);
	}

	function blockedPushTitle(row: Project): string {
		const blocked = whyNotPush(row.git);
		if (blocked) return `Push is blocked (${blocked}). Fix that, then this button turns on.`;
		return needActionTitle('push', row);
	}

	function needActions(row: Project): NeedAction[] {
		const pins = cascadeFor(row.id)?.writable ?? 0;
		const acts: NeedAction[] = writesFor(row).map((id) => ({
			id,
			label: fleetWriteLabel(id, row, rowBumpKind(row), pins),
			title: needActionTitle(id, row),
			run: () => {
				if (id === 'publish' || id === 'cut') startPublish([row.id]);
				else if (id === 'push') startPush([row.id]);
				else startCascade(row.id);
			},
		}));
		if (row.unpublishedAhead && !acts.some((act) => act.id === 'publish')) {
			acts.unshift({
				id: 'publish',
				label: fleetWriteLabel('publish', row),
				title: blockedPublishTitle(row),
				run: () => {},
				disabled: true,
			});
		}
		if ((row.git.ahead ?? 0) > 0 && !acts.some((act) => act.id === 'push')) {
			const pushAct: NeedAction = {
				id: 'push',
				label: fleetWriteLabel('push', row),
				title: blockedPushTitle(row),
				run: () => {},
				disabled: true,
			};
			const afterPub = acts.findIndex((act) => act.id === 'publish');
			if (afterPub >= 0) acts.splice(afterPub + 1, 0, pushAct);
			else acts.unshift(pushAct);
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
				'Engine is the locked getfilepress version. Sync engine <version> appears only when that site is behind or headers need a merge. Headers and ship stay on the job buttons, not extra columns.',
				'Land syncs getfilepress on the site, then Push → Ship. It does not publish filepress or a matching fleet package.',
				'Git push stays on Fleet — that board already shows branch, ahead, and origin.',
			);
		}
		bits.push('Check rows, then run a job on the selection.');
		return bits.filter(Boolean).join('\n\n');
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

<svelte:window
	onkeydown={(event) => {
		if (event.key === 'Escape' && activityOpen && !confirmOpen && !addOpen) setActivityOpen(false);
	}}
/>

<div class="shell">
	<header>
		<div class="head-row">
			<div class="brand">
				<img class="mark" src="/logo.png" alt="" width="96" height="64" />
				<div class="brand-copy">
					<h1>LocalHelm</h1>
					{#if needChips.length}
						<div class="chips">
							{#each needChips as chip (chip.id)}
								<button
									type="button"
									class="chip"
									class:hot={chip.tone === 'hot'}
									class:warm={chip.tone === 'warm'}
									class:bad={chip.tone === 'bad'}
									title="Open Today"
									onclick={() => setTab(chip.tab)}
								>
									{chip.label}
								</button>
							{/each}
						</div>
					{/if}
				</div>
			</div>

			<div class="actions">
				<button
					class="btn"
					disabled={Boolean(busy)}
					onclick={() => refresh()}
					title="Re-read every enrolled project, plus Sites and Ports. For one row, use the refresh icon on that row."
				>
					<Icon icon="lucide:refresh-cw" />
					Refresh
				</button>
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
					title="Shows which repos are ahead of origin. Confirm in the modal. Never --force. Uncommitted files stay local."
				>
					<Icon icon="lucide:upload" />
					Push
				</button>
				<IconButton
					icon="lucide:scroll-text"
					label={activityOpen ? 'Close activity log' : 'Open activity log'}
					title="Activity — every plan and write"
					pressed={activityOpen}
					hot={activityUnseen}
					badge={activityUnseen ? 'new' : entries.length || ''}
					onclick={() => setActivityOpen(!activityOpen)}
				/>
				<HelmMenu
					plugins={pluginMetas}
					busy={Boolean(busy)}
					fleetPath={inventory?.manifestPath ?? ''}
					{serveLine}
					{npmUser}
					{fetchedAt}
					{statusReady}
					{briefCopied}
					onToggle={(id, enabled) => void setPluginOn(id, enabled)}
					onCopyBrief={() => void copyBrief()}
					onFetchRemotes={() => refresh(true)}
					onExport={() => void startExport()}
				/>
			</div>
		</div>
		<div class="status-rail" aria-live="polite">
			{#if busy}
				<p class="line busy">Working: {busy}…</p>
			{:else if error}
				<p class="line err">{error}</p>
			{:else if staleRemotes}
				<p class="line info">Some remotes could not be read, so ahead and behind counts may be stale. Local state below is accurate.</p>
			{:else}
				<p class="line idle" aria-hidden="true">&nbsp;</p>
			{/if}
		</div>
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
		{#each pluginTabs as plug (plug.id)}
			<button
				type="button"
				class="tab"
				class:active={canonicalizeTab(tab) === plug.id}
				class:hot={plug.id === 'localslip' && portsNeedingYou.length > 0}
				onclick={() => setTab(plug.id)}
			>
				<Icon icon={pluginTabIcon(plug.id)} />
				{plug.label}
				{#if pluginTabCount(plug.id, pluginBoards)}
					<span class="count quiet">{pluginTabCount(plug.id, pluginBoards)}</span>
				{/if}
			</button>
		{/each}
	</nav>

	<div class="workspace">
	<main class:fill-pane={tab === 'today'}>
		{#if tab === 'today'}
			<div class="today-board">
				<section class="panel fill today-needs">
					<div class="section-head">
						<div>
							<h2>Needs you</h2>
							<p class="hint">
								{#if !statusReady}
									Reading fleet…
								{:else}
									Fleet writes you can confirm. Looks, below, is Ports facts with no gold button.
								{/if}
							</p>
							<div class="need-filters" role="group" aria-label="Needs you filter">
								{#each [
									{ id: 'all' as const, label: 'All' },
									{ id: 'publish' as const, label: 'Publish' },
									{ id: 'cut' as const, label: 'Cut' },
									{ id: 'push' as const, label: 'Push' },
								] as chip (chip.id)}
									<button
										type="button"
										class="chip"
										class:on={needFilter === chip.id}
										aria-pressed={needFilter === chip.id}
										onclick={() => (needFilter = chip.id)}
									>
										{chip.label}
										{#if statusReady}<span class="count quiet">{needFilterCounts[chip.id]}</span>{/if}
									</button>
								{/each}
							</div>
						</div>
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
					<div class="panel-body">
						{#if statusReady && attentionRows.length === 0 && cascadeOnlyRows.length === 0}
							<p class="quiet-banner">All quiet on the fleet. Looks, FilePress, and LocalSlip stay in the other panes.</p>
						{:else if statusReady && filteredAttentionRows.length === 0 && filteredCascadeRows.length === 0}
							<p class="dim small">
								{#if needFilter === 'publish'}
									No version waiting on npm. All still shows dirty trees and Write pins.
								{:else if needFilter === 'cut'}
									No origin commits since the last npm version. All still shows Push and Publish.
								{:else}
									Nothing to push. All still shows Cut, Publish, and Write pins.
								{/if}
							</p>
						{:else if statusReady}
							<ul class="need-list">
								{#each filteredAttentionRows as row (row.id)}
									{@const cascadeTarget = cascadeFor(row.id)}
									{@const acts = needActions(row)}
									<li class="need-card">
										<div class="need-main">
											<div class="need-id-row">
												<IconButton
													compact
													icon="lucide:refresh-cw"
													label={`Refresh ${row.id}`}
													title="Re-read this row only."
													disabled={Boolean(busy)}
													onclick={() => void refreshRows([row.id])}
												/>
												<span class="id">{row.id}</span>
											</div>
											<div class="dim small">
												{row.npm.name ?? row.path} · {gitSummary(row)}
												{#if cascadeTarget}
													· dependents {cascadeTarget.behind ? `${cascadeTarget.behind} behind` : ''}{cascadeTarget.behind && cascadeTarget.linked ? ', ' : ''}{cascadeTarget.linked ? `${cascadeTarget.linked} local link` : ''}
												{/if}
											</div>
										</div>
										<div class="need-tools">
											<div class="badges">
												{#each todayBadges(row) as badge (badge.text)}
													<span class={`badge ${badge.tone}`} title={badge.title ?? ''}>{badge.text}</span>
												{/each}
											</div>
											<div class="need-actions">
												{#each acts as act, i (act.id)}
													<button
														class="btn btn-sm"
														class:btn-write={i === 0 && !act.disabled}
														disabled={Boolean(busy) || Boolean(act.disabled)}
														onclick={act.run}
														title={act.title}
													>
														{act.label}
													</button>
												{/each}
											</div>
										</div>
									</li>
								{/each}
								{#each filteredCascadeRows as target (target.id)}
									<li class="need-card">
										<div class="need-main">
											<div class="need-id-row">
												<span class="need-refresh-slot" aria-hidden="true"></span>
												<span class="id">{target.id}</span>
											</div>
											<div class="dim small">
												{target.npm}{target.latest ? `@${target.latest}` : ''} is published — dependents still need the pin
											</div>
										</div>
										<div class="need-tools">
											<div class="badges">
												{#if target.behind}<span class="badge warn">{target.behind} {target.behind === 1 ? 'pin behind' : 'pins behind'}</span>{/if}
												{#if target.linked}<span class="badge info">{target.linked} local link</span>{/if}
											</div>
											<div class="need-actions">
												<button
													class="btn btn-sm btn-write"
													disabled={Boolean(busy)}
													onclick={() => startCascade(target.id)}
													title="Shows which dependents would get the new pin. Confirm in the modal to write."
												>
													{target.writable === 1 ? 'Write 1 pin' : `Write ${target.writable} pins`}
												</button>
											</div>
										</div>
									</li>
								{/each}
							</ul>
						{/if}
					</div>
				</section>

				<section class="panel fill today-looks">
					<div class="section-head">
						<div>
							<h2>Looks</h2>
							<p class="hint">
								{#if portLookCards.length}
									{portLookCards.length} Ports fact{portLookCards.length === 1 ? '' : 's'} — missing recipe, split stack, or enroll vs lease. No gold write here.
								{:else}
									Ports facts (recipe, stack, enroll), not fleet writes.
								{/if}
							</p>
						</div>
					</div>
					<div class="panel-body">
						{#if !statusReady}
							<p class="dim small">Reading looks…</p>
						{:else if !portLookCards.length}
							<p class="dim small">Nothing to look at. Stacks and down leases stay on Ports.</p>
						{:else}
							<ul class="need-list">
								{#each portLookCards as look (look.id)}
									<li class="need-card">
										<div class="need-main">
											<div class="need-id-row">
												<span class="id">{look.title}</span>
												<CrossChips compact chips={chipsFor(look.title)} onOpen={(kind) => openCross(look.title, kind)} />
											</div>
											<Tooltip wide title={look.detail}>
												<div class="dim small">{look.detail}</div>
											</Tooltip>
										</div>
										<div class="need-tools">
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
										</div>
									</li>
								{/each}
							</ul>
						{/if}
					</div>
				</section>

				<div class="today-side">
					<section class="panel fill">
						<div class="section-head">
							<div>
								<h2>FilePress Sites</h2>
								<p class="hint">
									{#if !statusReady}
										Reading sites…
									{:else if !filepressBoard}
										No FilePress plugin loaded.
									{:else if sitesNeedingYou.length}
										{sitesNeedingYou.length} of {filepressBoard.rows.length} need an engine write. Land does Sync, then Push and Ship.
									{:else}
										{filepressBoard.rows.length} sites · none waiting on an engine sync.
									{/if}
								</p>
							</div>
							<div class="group-buttons">
								{#if filepressSyncIds.length}
									<button
										class="btn btn-write btn-sm"
										disabled={Boolean(busy)}
										onclick={() => startLand(filepressSyncIds)}
										title="Plans Land for every site that needs an engine write. Confirm in the modal."
									>
										<Icon icon="lucide:plane-landing" />
										Land{filepressSyncIds.length > 1 ? ` ${filepressSyncIds.length}` : ''}
									</button>
									<button
										class="btn btn-write btn-sm"
										disabled={Boolean(busy)}
										onclick={() => startPluginJob(filepressBoard.plugin, 'sync', filepressSyncIds, 'Sync engine')}
										title="Shows which FilePress sites need an engine sync. Confirm in the modal to write."
									>
										<Icon icon="lucide:refresh-cw" />
										Sync engine
									</button>
								{/if}
								<button type="button" class="btn btn-sm" onclick={() => setTab('filepress')}><Icon icon="lucide:arrow-right" /> FilePress Sites</button>
							</div>
						</div>
						<div class="panel-body">
							{#if statusReady && filepressBoard && sitesNeedingYou.length}
								<ul class="need-list">
									{#each sitesNeedingYou as site (site.id)}
										<li class="need-card">
											<div class="need-main">
												<div class="id">{site.id}</div>
												<div class="dim small">{siteNeedReason(site.cells)}</div>
											</div>
											<div class="need-tools">
												<div class="need-actions">
													<button
														class="btn btn-sm btn-write"
														disabled={Boolean(busy)}
														onclick={() => startLand([site.id])}
														title="Plans Sync → Push → Ship for this site. Confirm in the modal."
													>
														<Icon icon="lucide:plane-landing" />
														Land
													</button>
												</div>
											</div>
										</li>
									{/each}
								</ul>
							{:else if statusReady && filepressBoard}
								<p class="dim small">Open FilePress Sites for the full board.</p>
							{:else if statusReady}
								<p class="dim small">Enroll the filepress checkout to expose <code>localhelm.plugin.mjs</code>.</p>
							{/if}
						</div>
					</section>
					<section class="panel fill">
						<div class="section-head">
							<div>
								<h2>Ports</h2>
								<p class="hint">
									{#if !statusReady}
										Reading ports…
									{:else if !leaseBoard}
										No Ports plugin loaded.
									{:else}
										{leaseBoard.rows.length} lease{leaseBoard.rows.length === 1 ? '' : 's'}
										{#if portFamilyCards.length}
											· {portFamilyCards.length} stack{portFamilyCards.length === 1 ? '' : 's'}
										{/if}
										{#if portsNeedingYou.length}
											· {portsNeedingYou.length} down or conflicted
										{:else}
											· all listening
										{/if}
									{/if}
								</p>
							</div>
							<button type="button" class="btn btn-sm" onclick={() => setTab('localslip')}><Icon icon="lucide:arrow-right" /> LocalSlip Ports</button>
						</div>
						<div class="panel-body">
							{#if statusReady && leaseBoard}
								<div class="ports-snapshot">
									{#if portFamilyCards.length}
										<div>
											<h3 class="looks-head">Stacks</h3>
											<ul class="need-list">
												{#each portFamilyCards as family (family.stem)}
													<li class="need-card">
														<div class="need-main">
															<div class="id">{family.label}</div>
															<div class="dim small">{family.bits}</div>
														</div>
														<div class="need-tools">
															<div class="need-actions">
																<button
																	type="button"
																	class="btn btn-sm"
																	onclick={() => openPortsStacks()}
																	title="Opens the Stacks table. Start and Stop live on each row."
																>
																	Open
																</button>
															</div>
														</div>
													</li>
												{/each}
											</ul>
										</div>
									{/if}
									{#if portsNeedingYou.length}
										<div>
											<h3 class="looks-head">Down or conflicted</h3>
											<ul class="need-list">
												{#each portsNeedingYou as row (row.id)}
													<li class="need-card">
														<div class="need-main">
															<div class="id">{row.label ?? row.id}</div>
															<div class="dim small">
																{row.cells.port ?? '—'}
																· {row.cells.listening === 'no' ? 'not listening' : row.cells.conflict === 'yes' ? 'conflict' : row.cells.firewall}
															</div>
														</div>
													</li>
												{/each}
											</ul>
										</div>
									{/if}
								</div>
							{:else if statusReady}
								<p class="dim small">Enroll the localslip checkout to expose <code>localhelm.plugin.mjs</code>.</p>
							{/if}
						</div>
					</section>
				</div>
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
								disabled={Boolean(busy) || !checkedPushIds.length}
								onclick={() => startPush(checkedIds)}
								title="Shows which checked repos would push to origin. The count is how many are ahead, not how many are checked. Confirm in the modal. Never --force."
							>
								<Icon icon="lucide:upload" />
								Push{checkedPushIds.length ? ` (${checkedPushIds.length})` : ''}
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
									<th>version</th>
									<th>git</th>
									<th>fleet pins</th>
									<th>needs you</th>
									<th>version bump</th>
								</tr>
							</thead>
							<tbody>
								{#each visibleProjects as row (row.id)}
									{@const projectMeta = fleetProjectMeta(row.id, row.npm.name, row.path)}
									{@const bumpTo = nextCutVersion(row, rowBumpKind(row))}
									<tr>
										<td class="tick"><input type="checkbox" aria-label={`select ${row.id}`} bind:checked={selectedIds[row.id]} /></td>
										<td>
											<div class="project-cell">
												<span class="id">{row.id}</span>
												{#if projectMeta}
													<span class="dim small">{projectMeta}</span>
												{/if}
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
										<td class="mono" class:ahead={row.unpublishedAhead}>{fleetVersionLabel(row)}</td>
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
															disabled={Boolean(busy) || Boolean(act.disabled)}
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
													{bumpTo ? `Bump ${bumpTo}` : 'Bump'}
												</button>
											</div>
										</td>
									</tr>
								{/each}
								{#if !inventory?.projects.length}
									<tr><td class="empty" colspan="7">Nothing enrolled yet. Open Add projects, scan a folder, tick the ones you ship, then write.</td></tr>
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
		{:else if !isPortsPluginTab(tab) && tab !== 'today' && tab !== 'fleet'}
			{#each siteBoards as board (board.plugin + board.title)}
				{@const siteCols = siteTableColumns(board.plugin, board.columns)}
				<section class="panel plugin-board">
					<div class="section-head">
						<div>
							<h2>{board.title}</h2>
							<InfoHint
								summary={board.plugin === 'filepress'
									? 'Content sites. Check rows, then Land, Sync, or Ship. Land still pushes. Git push is on Fleet.'
									: 'Check rows, then run a job on the selection.'}
								detail={siteBoardHelp(board)}
							/>
						</div>
						<div class="group-buttons">
							{#if board.plugin === 'filepress'}
								{@const landIds = board.rows.filter((row) => selectedSites[row.id]).map((row) => row.id)}
								{@const syncIds = board.rows
									.filter((row) => selectedSites[row.id] && siteNeedsEngineSync(row.cells))
									.map((row) => row.id)}
								<button
									class="btn btn-write"
									disabled={Boolean(busy) || landIds.length === 0}
									onclick={() => startLand(landIds)}
									title="Plans Sync → Push → Ship for the checked sites. Confirm in the modal."
								>
									<Icon icon="lucide:plane-landing" />
									Land{landIds.length ? ` (${landIds.length})` : ''}
								</button>
								<button
									class="btn btn-write"
									disabled={Boolean(busy) || syncIds.length === 0}
									onclick={() => startPluginJob(board.plugin, 'sync', syncIds, 'Sync engine')}
									title="Retargets getfilepress and merges headers for the checked sites that are behind. Confirm in the modal."
								>
									<Icon icon="lucide:refresh-cw" />
									Sync engine{syncIds.length ? ` (${syncIds.length})` : ''}
								</button>
							{/if}
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
									{@const liveHref = pluginRowOpenHref(row)}
									{@const localHref = siteLocalHref(row.id, leaseBoardAll?.rows ?? [])}
									{@const rowNote = pluginRowNote(board.plugin, row.cells)}
									<tr>
										<td class="tick">
											<input type="checkbox" aria-label={`select ${row.id}`} bind:checked={selectedSites[row.id]} />
										</td>
										<td>
											<div class="project-cell">
												{#if liveHref}
													<a
														class="id live-link"
														href={liveHref}
														target="_blank"
														rel="noopener noreferrer"
														title={`Open ${liveHref} in a new tab`}
													>{row.label ?? row.id}</a>
												{:else}
													<span class="id">{row.label ?? row.id}</span>
												{/if}
												<CrossChips compact chips={chipsFor(row.id, 'sites')} onOpen={(kind) => openCross(row.id, kind)} />
												{#if rowNote}<span class="chip quiet">{rowNote}</span>{/if}
											</div>
										</td>
										{#each siteCols as col (col.id)}
											{@const cellLabel = siteCellValue(col.id, row.cells)}
											{@const cellLinks = pluginCellLinks(row, col.id, cellLabel)}
											<td class="small" class:mono={col.id === 'engine'}>
												{#if cellLinks.length}
													{#each cellLinks as item, i (`${col.id}:${item.label}:${i}`)}
														{#if i > 0}<span class="dim"> · </span>{/if}
														{#if item.href}
															<a class="live-link" href={item.href} target="_blank" rel="noopener noreferrer" title={`Open ${item.href}`}>{item.label}</a>
														{:else}
															<span>{item.label}</span>
														{/if}
													{/each}
												{:else}
													{cellLabel}
												{/if}
											</td>
										{/each}
										<td>
											<div class="bump">
												{#if localHref}
													<Tooltip title={`Open ${localHref}`}>
														<a
															class="open-link"
															href={localHref}
															target="localslip-open"
															rel="noopener"
															aria-label={`Open ${row.label ?? row.id} locally`}
														>
															<Icon icon="lucide:square-arrow-out-up-right" />
														</a>
													</Tooltip>
												{/if}
												{#if board.plugin === 'filepress'}
													<button
														class="btn btn-sm btn-write"
														disabled={Boolean(busy)}
														onclick={() => startLand([row.id])}
														title="Plans Sync → Push → Ship for this site. Confirm in the modal."
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
												{#each row.actions.filter((act) => sitePluginJobVisible(board.plugin, act.id)) as act (act.id)}
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
				{@const plugMeta = pluginTabs.find((plug) => plug.id === canonicalizeTab(tab))}
				<section class="panel">
					<h2>{plugMeta?.label ?? canonicalizeTab(tab)}</h2>
					{#if !statusReady}
						<p class="hint">Reading {plugMeta?.label ?? 'plugin'}…</p>
					{:else}
						<p class="hint">No {plugMeta?.label ?? canonicalizeTab(tab)} plugin loaded. Enroll the checkout that exposes <code>localhelm.plugin.mjs</code>.</p>
					{/if}
				</section>
			{/each}
		{:else if isPortsPluginTab(tab)}
			{#if !statusReady && !portBoards.length}
				<section class="panel">
					<h2>LocalSlip Ports</h2>
					<p class="hint">Reading ports…</p>
				</section>
			{:else if !portBoards.length}
				<section class="panel">
					<h2>LocalSlip Ports</h2>
					<p class="hint">No LocalSlip plugin loaded. Enroll the localslip checkout to expose <code>localhelm.plugin.mjs</code>.</p>
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
						id="tab-stacks"
						aria-controls="pane-ports"
						aria-selected={portPane === 'stacks'}
						class:active={portPane === 'stacks'}
						onclick={() => setPortPane('stacks')}
					>
						Stacks
						{#if portFamilyCards.length}<span class="count quiet">{portFamilyCards.length}</span>{/if}
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
				{#if portPane === 'stacks'}
					<section class="panel plugin-board" id="pane-ports" aria-labelledby="tab-stacks">
						<div class="section-head">
							<div>
								<h2>Stacks</h2>
								<InfoHint
									summary="One row per family. Start and Stop run that family’s leases."
									detail="A stack is fleet + lease ids that share a stem (hyphens fold; -site and -api strip). Each button plans first, then confirm. Claim and release stay on the localslip CLI."
								/>
							</div>
						</div>
						{#if portFamilyCards.length}
							<div class="table-wrap">
								<table>
									<thead>
										<tr>
											<th>stack</th>
											<th>status</th>
											<th>leases</th>
											<th></th>
										</tr>
									</thead>
									<tbody>
										{#each portFamilyCards as family (family.stem)}
											<tr>
												<td>
													<div class="project-cell">
														<span class="id">{family.label}</span>
													</div>
												</td>
												<td class="small">{family.bits}</td>
												<td class="small dim">{family.leaseIds.join(' · ') || '—'}</td>
												<td>
													<div class="port-actions">
														<Tooltip title="Plans start for every unparked lease in this family. Confirm in the modal.">
															<button
																class="btn btn-sm btn-write"
																disabled={Boolean(busy) || !stackCanStart(family)}
																onclick={() => startFamilyJob('start', family.leaseIds)}
															>
																<Icon icon="lucide:play" />
																Start
															</button>
														</Tooltip>
														<Tooltip title="Plans stop for every unparked lease in this family. Confirm in the modal.">
															<button
																class="btn btn-sm btn-write"
																disabled={Boolean(busy) || !stackCanStop(family)}
																onclick={() => startFamilyJob('stop', family.leaseIds)}
															>
																<Icon icon="lucide:square" />
																Stop
															</button>
														</Tooltip>
													</div>
												</td>
											</tr>
										{/each}
									</tbody>
								</table>
							</div>
						{:else if statusReady}
							<p class="dim small">No stacks yet. A family appears when a fleet row and a lease share a stem.</p>
						{/if}
					</section>
				{:else if visiblePortBoard}
					{@const board = visiblePortBoard}
					{@const leaseActions = portPane === 'leases'}
					{@const portCols = portTableColumns(board.plugin, portPane, board.columns)}
					{@const viewRows = portPane === 'observed' ? observedViewRows : leaseViewRows}
					<section class="panel plugin-board" id="pane-ports" aria-labelledby={portPane === 'observed' ? 'tab-observed' : 'tab-leases'}>
						<div class="section-head">
							<div>
								<h2>{board.title}</h2>
								<InfoHint
									summary={leaseActions
										? 'Named leases. Start and Stop run the recipe detached. Stacks live on the Stacks subtab.'
										: 'Observed listeners only. Claim and release stay on the localslip CLI.'}
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
						{#if leaseActions}
							<PortFilterBar variant="leases" bind:filters={leaseFilters} shown={viewRows.length} total={board.rows.length} />
						{:else}
							<PortFilterBar variant="observed" bind:filters={observedFilters} shown={viewRows.length} total={board.rows.length} />
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
											checked={portAllChecked(viewRows)}
											indeterminate={viewRows.some((row) => selectedPorts[row.id]) && !portAllChecked(viewRows)}
											onchange={(event) => togglePortAll(viewRows, event.currentTarget.checked)}
										/>
											</th>
										{/if}
										<th>{board.rowLabel ?? 'name'}</th>
										{#each portCols as col (col.id)}
											<th>{col.label}</th>
										{/each}
										<th></th>
									</tr>
								</thead>
								<tbody>
									{#each viewRows as row (row.id)}
										<tr>
											{#if leaseActions}
												<td class="tick">
													<input type="checkbox" aria-label={`select ${row.id}`} bind:checked={selectedPorts[row.id]} />
												</td>
											{/if}
											<td>
												<div class="project-cell">
													<span class="id">{row.label ?? row.id}</span>
													<CrossChips compact chips={chipsFor(row.id, 'ports')} onOpen={(kind) => openCross(row.id, kind)} />
												</div>
											</td>
											{#each portCols as col (col.id)}
												<td class="small" class:mono={col.id === 'port'}>
													{#if col.id === 'recipe'}
														<Tooltip wide title={healthTip(row)}>{portCellValue(col.id, row.cells)}</Tooltip>
													{:else}
														{portCellValue(col.id, row.cells)}
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
																target="localslip-open"
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
									{#if !viewRows.length}
										<tr>
											<td class="empty" colspan={portCols.length + (leaseActions ? 3 : 2)}>
												{board.rows.length ? (leaseActions ? 'No leases match.' : 'Nothing matches.') : 'Nothing here.'}
											</td>
										</tr>
									{/if}
								</tbody>
							</table>
						</div>
					</section>
				{/if}
				<p class="dim small port-cli">
					<code>localslip recipe name --cwd PATH</code>
					·
					<code>localslip start name</code>
					·
					<code>localslip stop name</code>
					·
					<code>localslip claim name --port N</code>
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
						{#if candidateFolderLabel(row) !== row.id}
							<div class="path" title={row.absPath}>{candidateFolderLabel(row)}</div>
						{/if}
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
	itemKeys={confirmItemKeys}
	itemPhases={confirmPhases}
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
		align-items: center;
		gap: 1.25rem;
	}

	.brand {
		display: flex;
		align-items: center;
		gap: 0.85rem;
		min-width: 0;
	}

	.brand-copy {
		min-width: 0;
	}

	.mark {
		width: 6rem;
		height: auto;
		flex-shrink: 0;
	}

	h1 {
		font-size: 1.45rem;
		font-weight: 600;
		margin: 0;
	}

	h2 {
		display: inline-flex;
		align-items: center;
		font-size: 1.02rem;
		font-weight: 600;
		margin: 0;
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
		align-items: center;
		gap: 0.45rem;
	}

	h2 :global(.icon) {
		margin-right: 0.35rem;
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
		text-decoration: none;
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
		gap: 0.35rem;
		margin-top: 0.35rem;
	}

	.chip {
		border: 1px solid #4c4c54;
		background: #333338;
		border-radius: 999px;
		padding: 0.12rem 0.6rem;
		font-size: 0.72rem;
		line-height: 1.35;
		color: #c4c4cc;
		font-family: inherit;
		cursor: pointer;
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

	.need-filters {
		display: flex;
		flex-wrap: wrap;
		gap: 0.35rem;
		margin-top: 0.4rem;
	}

	.need-filters .chip {
		display: inline-flex;
		align-items: center;
		gap: 0.3rem;
	}

	.need-filters .count {
		font-size: 0.65rem;
		border: 1px solid #8b8b93;
		background: #3a3a42;
		border-radius: 999px;
		padding: 0 0.35rem;
		color: #f4f4f5;
	}

	.chip.on {
		border-color: #c9a227;
		background: #4a3a12;
		color: #fde68a;
	}

	.chip.quiet {
		border-style: dashed;
		cursor: default;
	}

	.status-rail {
		display: flex;
		align-items: center;
		min-height: 1.4rem;
		margin-top: 0.25rem;
	}

	.line {
		margin: 0;
		font-size: 0.8rem;
		line-height: 1.35;
	}

	.line.idle {
		visibility: hidden;
		user-select: none;
	}

	.busy {
		color: #fcd34d;
	}

	.err {
		color: #f87171;
		max-height: 4.5em;
		overflow: auto;
		word-break: break-word;
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

	main.fill-pane {
		overflow: hidden;
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

	.today-board,
	.fleet-layout {
		display: grid;
		gap: 0.75rem;
	}

	.today-board {
		flex: 1;
		min-height: 0;
		grid-template-columns: 1fr;
	}

	.today-side {
		display: grid;
		gap: 0.75rem;
		min-height: 0;
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
		.today-board {
			grid-template-columns: minmax(0, 1.45fr) minmax(20rem, 0.9fr);
			grid-template-rows: minmax(0, 1.1fr) minmax(0, 1fr);
			grid-template-areas:
				'needs side'
				'looks side';
		}

		.today-needs {
			grid-area: needs;
		}

		.today-looks {
			grid-area: looks;
		}

		.today-side {
			grid-area: side;
			grid-template-rows: auto minmax(0, 1fr);
		}

		.today-side > .panel.fill:first-child {
			max-height: 42%;
		}

		.fleet-layout {
			grid-template-columns: minmax(0, 1fr);
		}
	}

	@media (max-width: 1099px) {
		main.fill-pane {
			overflow: auto;
		}

		.today-needs .panel-body,
		.today-looks .panel-body {
			max-height: 22rem;
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
		flex-wrap: nowrap;
		align-items: center;
		gap: 0.2rem 0.45rem;
		white-space: nowrap;
	}

	.project-cell .id {
		margin: 0;
	}

	.live-link,
	.live-link:visited {
		color: #fde68a;
		text-decoration: underline;
		text-underline-offset: 0.12em;
	}

	.live-link:hover {
		color: #fff3b0;
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

	.panel.fill {
		display: flex;
		flex-direction: column;
		min-height: 0;
		overflow: hidden;
	}

	.panel.fill .section-head {
		flex-shrink: 0;
		margin-bottom: 0.4rem;
	}

	.panel-body {
		flex: 1;
		min-height: 0;
		overflow: auto;
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
	}

	.looks-head {
		margin: 0 0 0.2rem;
		font-size: 1rem;
	}

	.need-card {
		display: flex;
		flex-wrap: nowrap;
		align-items: center;
		gap: 0.5rem 0.65rem;
		background: #3d3d46;
		border: 1px solid #585860;
		border-radius: 0.45rem;
		padding: 0.4rem 0.55rem;
	}

	.need-main {
		min-width: 0;
		flex: 1 1 auto;
	}

	.need-id-row {
		display: flex;
		align-items: center;
		gap: 0.35rem;
		min-width: 0;
	}

	.need-refresh-slot {
		display: inline-block;
		width: 1.35rem;
		height: 1.35rem;
		flex-shrink: 0;
	}

	.need-tools {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: flex-end;
		gap: 0.3rem;
		flex: 0 1 auto;
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
		margin-left: 0;
	}

	.need-actions:empty {
		display: none;
	}

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
		list-style: none;
		margin: 0.5rem 0;
		padding: 0;
		max-height: min(28rem, 50dvh);
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

	.candidates li > div {
		min-width: 0;
	}

	.candidates .path {
		margin-top: 0.05rem;
		color: #a8a8b0;
		font-size: 0.72rem;
		font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
		overflow-wrap: anywhere;
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
