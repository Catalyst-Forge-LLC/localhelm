<script lang="ts">
	import Icon from './Icon.svelte';
	import IconButton from './IconButton.svelte';
	import Tooltip from './Tooltip.svelte';
	import { bridgeIdleLine, type HeaderNeedChip } from './fleetDisplay';
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
		activityOpen,
		activityBadge = '',
		onRefresh,
		onPull,
		onPush,
		onToggleActivity,
		onLamp,
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
		activityOpen: boolean;
		activityBadge?: string | number;
		onRefresh: () => void;
		onPull: () => void;
		onPush: () => void;
		onToggleActivity: () => void;
		onLamp: (filter: NeedFilter) => void;
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
	const npmHeading = $derived.by(() => {
		if (npmUser) return `npm ${npmUser}`;
		if (statusReady) return 'npm not signed in';
		return '';
	});
</script>

<header class="bridge">
	<div class="bridge-bays">
		<div class="bridge-ident" data-bridge="ident">
			<div class="brand">
				<img class="mark" src="/logo.png" alt="" width="96" height="64" />
				<div class="brand-copy">
					<h1>LocalHelm</h1>
					{#if serveHostPort || npmHeading}
						<p class="heading-line">
							{#if serveHostPort}
								{#if serveNote}
									<Tooltip title={serveNote}>
										<code class="heading-host">{serveHostPort}</code>
									</Tooltip>
								{:else}
									<code class="heading-host">{serveHostPort}</code>
								{/if}
							{/if}
							{#if serveHostPort && npmHeading}
								<span class="heading-sep" aria-hidden="true">·</span>
							{/if}
							{#if npmHeading}
								<span class="heading-npm">{npmHeading}</span>
							{/if}
						</p>
					{/if}
				</div>
			</div>
		</div>

		<div class="bridge-situation" data-bridge="situation" class:held={reading && statusReady}>
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
		</div>

		<div class="bridge-conn" data-bridge="conn">
			<div class="actions">
				<button
					class="btn btn-sounding"
					disabled={Boolean(busy)}
					onclick={onRefresh}
					title="Re-read every enrolled project, plus Sites and Ports. For one row, use the refresh icon on that row."
				>
					<Icon icon="lucide:refresh-cw" />
					Refresh
				</button>
				<button
					class="btn btn-write"
					disabled={Boolean(busy)}
					onclick={onPull}
					title="Shows which clean, behind repos would fast-forward. Confirm in the modal to pull."
				>
					<Icon icon="lucide:git-pull-request" />
					Pull
				</button>
				<button
					class="btn btn-write"
					disabled={Boolean(busy)}
					onclick={onPush}
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
					hot={activityBadge === 'new'}
					badge={activityBadge}
					onclick={onToggleActivity}
				/>
				{@render children()}
			</div>
		</div>
	</div>
	<div class="bridge-keel status-rail" data-bridge="keel" aria-live="polite">
		<p class="line {keelKind}" class:live={reading}>{keelText}</p>
	</div>
</header>
