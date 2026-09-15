<script lang="ts">
	import CellWait from '$lib/CellWait.svelte';
	import CrossChips from '$lib/CrossChips.svelte';
	import Icon from '$lib/Icon.svelte';
	import IconButton from '$lib/IconButton.svelte';
	import Tooltip from '$lib/Tooltip.svelte';
	import type { CrossChip } from '$lib/crosswalk';
	import type { CascadeTarget, NeedFilter, PluginBoard, PluginRow, Project } from '$lib/dashboardTypes';
	import type { PortFamily, PortLookGroup } from '$lib/looks';

	export type TodayBadge = { text: string; tone: 'ship' | 'warn' | 'bad' | 'info'; title?: string };
	export type TodayNeedAction = { id: string; label: string; title: string; run: () => void; disabled?: boolean };

	let {
		busy,
		statusReady,
		pluginsReady,
		needFilter = $bindable(),
		needFilterCounts,
		needBulkWrites,
		needCommitIds,
		needPublishIds,
		needPushIds,
		attentionEmpty,
		filteredEmpty,
		filteredAttentionRows,
		filteredCascadeRows,
		todayBadges,
		needActions,
		cascadeFor,
		gitSummary,
		portLookCards,
		chipsFor,
		filepressBoard,
		sitesNeedingLand,
		landPendingIds,
		filepressLandIds,
		filepressSyncIds,
		sitesNeedingYou,
		siteNeedReason,
		leaseBoard,
		portFamilyCards,
		portsNeedingYou,
		onRefreshRow,
		onCommit,
		onPublish,
		onPush,
		onCascade,
		onLand,
		onSyncEngine,
		onSetTab,
		onOpenCross,
		onOpenPortsFamily,
		onOpenPortsStacks,
	}: {
		busy: boolean;
		statusReady: boolean;
		pluginsReady: boolean;
		needFilter: NeedFilter;
		needFilterCounts: { all: number; publish: number; push: number; pins: number };
		needBulkWrites: boolean;
		needCommitIds: string[];
		needPublishIds: string[];
		needPushIds: string[];
		attentionEmpty: boolean;
		filteredEmpty: boolean;
		filteredAttentionRows: Project[];
		filteredCascadeRows: CascadeTarget[];
		todayBadges: (row: Project) => TodayBadge[];
		needActions: (row: Project) => TodayNeedAction[];
		cascadeFor: (id: string) => CascadeTarget | undefined;
		gitSummary: (row: Project) => string;
		portLookCards: PortLookGroup[];
		chipsFor: (id: string) => CrossChip[];
		filepressBoard: PluginBoard | null;
		sitesNeedingLand: PluginRow[];
		landPendingIds: string[];
		filepressLandIds: string[];
		filepressSyncIds: string[];
		sitesNeedingYou: PluginRow[];
		siteNeedReason: (siteId: string, cells: Record<string, string>) => string;
		leaseBoard: PluginBoard | null;
		portFamilyCards: PortFamily[];
		portsNeedingYou: PluginRow[];
		onRefreshRow: (id: string) => void;
		onCommit: (ids: string[]) => void;
		onPublish: (ids: string[]) => void;
		onPush: (ids: string[]) => void;
		onCascade: (id: string) => void;
		onLand: (ids: string[]) => void;
		onSyncEngine: (plugin: string, ids: string[]) => void;
		onSetTab: (tab: string) => void;
		onOpenCross: (id: string, kind: 'fleet' | 'sites' | 'ports') => void;
		onOpenPortsFamily: (ids: string[]) => void;
		onOpenPortsStacks: () => void;
	} = $props();

	const lookFactCount = $derived(portLookCards.reduce((n, card) => n + card.details.length, 0));
</script>

<div class="today-board">
	<section class="panel hud-frame fill today-needs">
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
						{ id: 'push' as const, label: 'Push' },
						{ id: 'pins' as const, label: 'Pins' },
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
			{#if needBulkWrites}
				<div class="group-buttons">
					{#if needCommitIds.length}
						<Tooltip title="Reads dirty files, asks Ollama for a message, then you confirm. git add + git commit. No push.">
							<button class="btn btn-write" disabled={busy} onclick={() => onCommit(needCommitIds)}>
								<Icon icon="lucide:git-commit-horizontal" />
								Commit dirty
							</button>
						</Tooltip>
					{/if}
					{#if needPublishIds.length}
						<Tooltip title="Shows bump (when needed), push, and npm publish. Confirm in the modal.">
							<button class="btn btn-write" disabled={busy} onclick={() => onPublish(needPublishIds)}>
								<Icon icon="lucide:package-up" />
								Publish
							</button>
						</Tooltip>
					{/if}
					{#if needPushIds.length}
						<Tooltip title="Shows which repos are ahead of origin. Confirm in the modal. Never --force. Uncommitted files stay local.">
							<button class="btn btn-write" disabled={busy} onclick={() => onPush(needPushIds)}>
								<Icon icon="lucide:upload" />
								Push ahead
							</button>
						</Tooltip>
					{/if}
				</div>
			{/if}
		</div>
		<div class="panel-body">
			{#if !statusReady}
				<p class="dim small"><CellWait label="Reading fleet…" showLabel /></p>
			{:else if attentionEmpty}
				<p class="quiet-banner">All quiet on the fleet. Looks, FilePress, and LocalSlip stay in the other panes.</p>
			{:else if filteredEmpty}
				<p class="dim small">
					{#if needFilter === 'publish'}
						Nothing waiting to publish. All still shows dirty trees and Write pins.
					{:else if needFilter === 'pins'}
						No pins behind. Cascade from the published package (Write pins), not the consumer. FilePress sites still use Land / Sync engine.
					{:else}
						Nothing to push. All still shows Publish and Write pins.
					{/if}
				</p>
			{:else}
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
										disabled={busy}
										onclick={() => onRefreshRow(row.id)}
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
										<Tooltip title={badge.title ?? badge.text}>
											<span class={`badge ${badge.tone}`}>{badge.text}</span>
										</Tooltip>
									{/each}
								</div>
								<div class="need-actions">
									{#each acts as act, i (act.id)}
										<Tooltip title={act.title}>
											<button
												class="btn btn-sm"
												class:btn-write={i === 0 && !act.disabled}
												disabled={busy || Boolean(act.disabled)}
												onclick={act.run}
											>
												{act.label}
											</button>
										</Tooltip>
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
									<Tooltip title="Shows which dependents would get the new pin. Confirm in the modal to write.">
										<button class="btn btn-sm btn-write" disabled={busy} onclick={() => onCascade(target.id)}>
											{target.writable === 1 ? 'Write 1 pin' : `Write ${target.writable} pins`}
										</button>
									</Tooltip>
								</div>
							</div>
						</li>
					{/each}
				</ul>
			{/if}
		</div>
	</section>

	<section class="panel hud-frame fill today-looks">
		<div class="section-head">
			<div>
				<h2>Looks</h2>
				<p class="hint">
					{#if portLookCards.length}
						{lookFactCount} Ports fact{lookFactCount === 1 ? '' : 's'}
						{#if lookFactCount !== portLookCards.length}
							on {portLookCards.length} lease{portLookCards.length === 1 ? '' : 's'}
						{/if}
						— missing recipe, split stack, or enroll vs lease. No gold write here.
					{:else}
						Ports facts (recipe, stack, enroll), not fleet writes.
					{/if}
				</p>
			</div>
		</div>
		<div class="panel-body">
			{#if !pluginsReady}
				<p class="dim small"><CellWait label="Reading looks…" showLabel /></p>
			{:else if !portLookCards.length}
				<p class="dim small">Nothing to look at. Stacks and down leases stay on Ports.</p>
			{:else}
				<ul class="need-list">
					{#each portLookCards as look (look.id)}
						<li class="need-card">
							<div class="need-main">
								<div class="need-id-row">
									<span class="id">{look.title}</span>
									<CrossChips compact chips={chipsFor(look.title)} onOpen={(kind) => onOpenCross(look.title, kind)} />
								</div>
								<Tooltip wide title={look.details.join(' · ')}>
									<div class="look-facts">
										{#each look.details as detail (detail)}
											<div class="dim small">{detail}</div>
										{/each}
									</div>
								</Tooltip>
							</div>
							<div class="need-tools">
								<div class="need-actions">
									<Tooltip title="Opens Ports with these leases checked.">
										<button type="button" class="btn btn-sm" onclick={() => onOpenPortsFamily(look.leaseIds)}>
											Open Ports
										</button>
									</Tooltip>
								</div>
							</div>
						</li>
					{/each}
				</ul>
			{/if}
		</div>
	</section>

	<div class="today-side">
		<section class="panel hud-frame fill today-sites">
			<div class="section-head">
				<div>
					<h2>FilePress Sites</h2>
					<p class="hint">
						{#if filepressBoard && sitesNeedingLand.length}
							{sitesNeedingLand.length} of {filepressBoard.rows.length} need Land.
							{#if landPendingIds.length}
								A failed ship stays here until it succeeds.
							{:else}
								Land does Sync, then Push and Ship.
							{/if}
						{:else if filepressBoard}
							{filepressBoard.rows.length} sites · none waiting on Land.
						{:else if !pluginsReady}
							Reading sites…
						{:else}
							No FilePress plugin loaded.
						{/if}
					</p>
				</div>
				<div class="group-buttons">
					{#if filepressLandIds.length}
						<Tooltip title="Plans Land for every site that needs an engine write or a finished ship. Confirm in the modal.">
							<button class="btn btn-write btn-sm" disabled={busy} onclick={() => onLand(filepressLandIds)}>
								<Icon icon="lucide:plane-landing" />
								Land{filepressLandIds.length > 1 ? ` ${filepressLandIds.length}` : ''}
							</button>
						</Tooltip>
					{/if}
					{#if filepressBoard && filepressSyncIds.length}
						<Tooltip title="Shows which FilePress sites need an engine sync. Confirm in the modal to write.">
							<button
								class="btn btn-write btn-sm"
								disabled={busy}
								onclick={() => onSyncEngine(filepressBoard.plugin, filepressSyncIds)}
							>
								<Icon icon="lucide:refresh-cw" />
								Sync engine
							</button>
						</Tooltip>
					{/if}
					<button type="button" class="btn btn-sm" onclick={() => onSetTab('filepress')}><Icon icon="lucide:arrow-right" /> FilePress Sites</button>
				</div>
			</div>
			<div class="panel-body">
				{#if filepressBoard && sitesNeedingYou.length}
					<ul class="need-list">
						{#each sitesNeedingYou as site (site.id)}
							<li class="need-card">
								<div class="need-main">
									<div class="id">{site.id}</div>
									<div class="dim small">{siteNeedReason(site.id, site.cells)}</div>
								</div>
								<div class="need-tools">
									<div class="need-actions">
										<Tooltip title="Plans Sync → Push → Ship for this site. Confirm in the modal.">
											<button class="btn btn-sm btn-write" disabled={busy} onclick={() => onLand([site.id])}>
												<Icon icon="lucide:plane-landing" />
												Land
											</button>
										</Tooltip>
									</div>
								</div>
							</li>
						{/each}
					</ul>
				{:else if filepressBoard}
					<p class="dim small">Open FilePress Sites for the full board.</p>
				{:else if !pluginsReady}
					<p class="dim small"><CellWait label="Reading sites…" showLabel /></p>
				{:else}
					<p class="dim small">Enroll the filepress checkout to expose <code>localhelm.plugin.mjs</code>.</p>
				{/if}
			</div>
		</section>
		<section class="panel hud-frame fill today-ports">
			<div class="section-head">
				<div>
					<h2>Ports</h2>
					<p class="hint">
						{#if leaseBoard}
							{leaseBoard.rows.length} lease{leaseBoard.rows.length === 1 ? '' : 's'}
							{#if portFamilyCards.length}
								· {portFamilyCards.length} stack{portFamilyCards.length === 1 ? '' : 's'}
							{/if}
							{#if portsNeedingYou.length}
								· {portsNeedingYou.length} down or conflicted
							{:else}
								· all listening
							{/if}
						{:else if !pluginsReady}
							Reading ports…
						{:else}
							No Ports plugin loaded.
						{/if}
					</p>
				</div>
				<button type="button" class="btn btn-sm" onclick={() => onSetTab('localslip')}><Icon icon="lucide:arrow-right" /> LocalSlip Ports</button>
			</div>
			<div class="panel-body">
				{#if leaseBoard}
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
													<Tooltip title="Opens the Stacks table. Start and Stop live on each row.">
														<button type="button" class="btn btn-sm" onclick={() => onOpenPortsStacks()}>
															Open
														</button>
													</Tooltip>
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
				{:else if !pluginsReady}
					<p class="dim small"><CellWait label="Reading ports…" showLabel /></p>
				{:else}
					<p class="dim small">Enroll the localslip checkout to expose <code>localhelm.plugin.mjs</code>.</p>
				{/if}
			</div>
		</section>
	</div>
</div>
