<script lang="ts">
	import Icon from './Icon.svelte';
	import IconButton from './IconButton.svelte';
	import Tooltip from './Tooltip.svelte';
	import { BRIDGE_GAUGE_C, bridgeGaugeFrac, bridgeIdleLine, type BridgeGauge, type HeaderNeedChip } from './fleetDisplay';
	import type { NeedFilter } from './dashboardTypes';

	let {
		busy,
		statusNote,
		error,
		staleCount = 0,
		statusReady,
		serveHostPort = '',
		serveNote = '',
		npmUser = null,
		fetchedAt = null,
		needChips,
		fleetCount,
		hiddenCount = 0,
		gauges,
		activityOpen,
		activityBadge = '',
		onRefresh,
		onPull,
		onPush,
		onToggleActivity,
		onLamp,
		onGauge,
		children,
	}: {
		busy: string;
		statusNote: string;
		error: string;
		staleCount?: number;
		statusReady: boolean;
		serveHostPort?: string;
		serveNote?: string;
		npmUser?: string | null;
		fetchedAt?: string | null;
		needChips: HeaderNeedChip[];
		fleetCount: number;
		hiddenCount?: number;
		gauges: BridgeGauge[];
		activityOpen: boolean;
		activityBadge?: string | number;
		onRefresh: () => void;
		onPull: () => void;
		onPush: () => void;
		onToggleActivity: () => void;
		onLamp: (filter: NeedFilter) => void;
		onGauge: (id: BridgeGauge['id']) => void;
		children: import('svelte').Snippet;
	} = $props();

	const reading = $derived(Boolean(busy || statusNote));
	const keelText = $derived.by(() => {
		if (busy) return `Working: ${busy}…`;
		if (statusNote) return statusNote.endsWith('…') ? statusNote : `${statusNote}…`;
		if (error) return error;
		if (statusReady) {
			return bridgeIdleLine({ fleetCount, hiddenCount, fetchedAt, staleCount, npmUser });
		}
		return 'Reading fleet…';
	});
	const keelKind = $derived.by(() => {
		if (busy) return 'busy';
		if (statusNote) return 'info';
		if (error) return 'err';
		return 'idle';
	});
</script>

<header class="bridge">
	<div class="bridge-bays">
		<div class="bridge-ident hud-frame" data-bridge="ident">
			<div class="brand">
				<img class="mark" src="/logo.png" alt="" width="96" height="64" />
				<div class="brand-copy">
					<h1>LocalHelm</h1>
					{#if serveHostPort}
						<p class="heading-line">
							{#if serveNote}
								<Tooltip title={serveNote}>
									<code class="heading-host">{serveHostPort}</code>
								</Tooltip>
							{:else}
								<code class="heading-host">{serveHostPort}</code>
							{/if}
						</p>
					{/if}
				</div>
			</div>
		</div>

		<div class="bridge-situation hud-frame" data-bridge="situation" class:held={reading && statusReady}>
			{#if needChips.length}
				<div class="lamps" role="group" aria-label="Fleet needs">
					{#each needChips as chip (chip.id)}
						<button
							type="button"
							class="lamp"
							class:hot={chip.tone === 'hot'}
							class:warm={chip.tone === 'warm'}
							class:bad={chip.tone === 'bad'}
							class:live={reading}
							aria-label="{chip.label} — open Today"
							onclick={() => onLamp(chip.need)}
						>
							<span class="lamp-dot" aria-hidden="true"></span>
							<span class="lamp-count">{chip.count}</span>
							<span class="lamp-word">{chip.word}</span>
						</button>
					{/each}
				</div>
			{:else if statusReady}
				<button
					type="button"
					class="lamp quiet"
					aria-label="All quiet — open Today"
					onclick={() => onLamp('all')}
				>
					<span class="lamp-dot" aria-hidden="true"></span>
					<span class="lamp-word">All quiet</span>
				</button>
			{:else}
				<p class="reading">Reading…</p>
			{/if}
			<div class="bridge-keel status-rail" data-bridge="keel" aria-live="polite">
				<p class="line {keelKind}" class:live={reading}>{keelText}</p>
			</div>
		</div>

		<div class="bridge-scope hud-frame" data-bridge="scope" role="group" aria-label="Fleet, sites, and slips">
			{#each gauges as gauge (gauge.id)}
				{@const frac = bridgeGaugeFrac(gauge.count, gauge.need)}
				{@const filled = BRIDGE_GAUGE_C * frac}
				<Tooltip title="{gauge.count} {gauge.label.toLowerCase()}{gauge.need ? ` · ${gauge.need} need you` : ''}">
				<button
					type="button"
					class="gauge"
					class:hot={gauge.need > 0}
					aria-label="{gauge.count} {gauge.label}{gauge.need ? `, ${gauge.need} need you` : ''} — open {gauge.label}"
					onclick={() => onGauge(gauge.id)}
				>
					<svg class="dial" viewBox="0 0 36 36" aria-hidden="true">
						<circle class="dial-track" cx="18" cy="18" r="14" />
						<circle
							class="dial-arc"
							cx="18"
							cy="18"
							r="14"
							stroke-dasharray="{filled} {BRIDGE_GAUGE_C}"
						/>
					</svg>
					<span class="gauge-count">{gauge.count}</span>
					<span class="gauge-word">{gauge.label}</span>
				</button>
				</Tooltip>
			{/each}
		</div>

		<div class="bridge-conn hud-frame" data-bridge="conn">
			<div class="actions">
				<Tooltip title="Re-read every enrolled project, plus Sites and Ports. For one row, use the refresh icon on that row.">
					<button class="btn btn-sounding" disabled={Boolean(busy)} onclick={onRefresh}>
						<Icon icon="lucide:refresh-cw" />
						Refresh
					</button>
				</Tooltip>
				<Tooltip title="Shows which clean, behind repos would fast-forward. Confirm in the modal to pull.">
					<button class="btn btn-write" disabled={Boolean(busy)} onclick={onPull}>
						<Icon icon="lucide:git-pull-request" />
						Pull
					</button>
				</Tooltip>
				<Tooltip title="Shows which repos are ahead of origin. Confirm in the modal. Never --force. Uncommitted files stay local.">
					<button class="btn btn-write" disabled={Boolean(busy)} onclick={onPush}>
						<Icon icon="lucide:upload" />
						Push
					</button>
				</Tooltip>
				<IconButton
					icon="lucide:scroll-text"
					label={activityOpen ? 'Close activity log' : 'Open activity log'}
					title="Activity — every plan and write"
					pressed={activityOpen}
					hot={activityBadge === 'new'}
					badge={activityBadge}
					onclick={onToggleActivity}
				/>
				{@render children()}
			</div>
		</div>
	</div>
</header>
