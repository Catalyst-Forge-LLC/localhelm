<script lang="ts">
	import { onMount } from 'svelte';
	import Icon from './Icon.svelte';
	import IconButton from './IconButton.svelte';
	import Tooltip from './Tooltip.svelte';

	type PluginItem = { id: string; label: string; source?: string; enabled: boolean };

	let {
		plugins,
		busy = false,
		fleetPath = '',
		serveLine = '',
		npmUser = null,
		fetchedAt = null,
		statusReady = false,
		briefCopied = false,
		onToggle,
		onCopyBrief,
		onFetchRemotes,
		onExport,
		demoBoard = false,
		onToggleDemo,
		onClearDemo,
		onRefresh,
		onPull,
		onPush,
		onToggleActivity,
		activityOpen = false,
		activityBadge = '',
	}: {
		plugins: PluginItem[];
		busy?: boolean;
		fleetPath?: string;
		serveLine?: string;
		npmUser?: string | null;
		fetchedAt?: string | null;
		statusReady?: boolean;
		briefCopied?: boolean;
		onToggle: (id: string, enabled: boolean) => void;
		onCopyBrief: () => void;
		onFetchRemotes: () => void;
		onExport: () => void;
		demoBoard?: boolean;
		onToggleDemo?: (next: boolean) => void;
		onClearDemo?: () => void;
		onRefresh?: () => void;
		onPull?: () => void;
		onPush?: () => void;
		onToggleActivity?: () => void;
		activityOpen?: boolean;
		activityBadge?: string | number;
	} = $props();

	let open = $state(false);
	let copiedPath = $state(false);
	let rootEl = $state<HTMLDivElement | null>(null);

	function close(): void {
		open = false;
	}

	function setBoard(next: boolean): void {
		if (!onToggleDemo || demoBoard === next || busy) return;
		close();
		onToggleDemo(next);
	}

	async function copyFleetPath(): Promise<void> {
		if (!fleetPath) return;
		try {
			await navigator.clipboard.writeText(fleetPath);
			copiedPath = true;
			setTimeout(() => {
				copiedPath = false;
			}, 1600);
		} catch {
			/* ignore */
		}
	}

	onMount(() => {
		function onPointer(event: PointerEvent): void {
			if (!open || !rootEl) return;
			if (event.target instanceof Node && rootEl.contains(event.target)) return;
			close();
		}
		function onKey(event: KeyboardEvent): void {
			if (event.key === 'Escape') close();
		}
		document.addEventListener('pointerdown', onPointer);
		document.addEventListener('keydown', onKey);
		return () => {
			document.removeEventListener('pointerdown', onPointer);
			document.removeEventListener('keydown', onKey);
		};
	});
</script>

<div class="helm-menu" bind:this={rootEl}>
	<IconButton
		icon="lucide:menu"
		label={open ? 'Close menu' : 'Open menu'}
		title="Plugins and board"
		pressed={open}
		onclick={() => (open = !open)}
	/>
	{#if open}
		<div class="panel hud-frame" role="menu" aria-label="LocalHelm menu">
			<p class="heading">This board</p>
			{#if onToggleDemo}
				<div class="pills" role="radiogroup" aria-label="Main or demo board">
					<button
						type="button"
						class="pill"
						class:on={!demoBoard}
						role="radio"
						aria-checked={!demoBoard}
						disabled={busy}
						onclick={() => setBoard(false)}
					>
						Main
					</button>
					<button
						type="button"
						class="pill"
						class:on={demoBoard}
						role="radio"
						aria-checked={demoBoard}
						disabled={busy}
						onclick={() => setBoard(true)}
					>
						Demo
					</button>
				</div>
				{#if demoBoard}
					<p class="hint">Practice add and remove. Repo writes stay off.</p>
				{/if}
			{/if}
			{#if fleetPath}
				<p class="meta">
					<Tooltip title="Copy fleet path">
					<button type="button" class="path" onclick={() => void copyFleetPath()}>
						<code>{fleetPath}</code>
						<span class="copy-hint">{copiedPath ? 'copied' : 'copy'}</span>
					</button>
					</Tooltip>
				</p>
			{:else if statusReady}
				<p class="hint">No fleet yet — Add projects on Today or Fleet, scan the folder that holds your repos, then write.</p>
			{/if}
			{#if serveLine}<p class="hint">{serveLine}</p>{/if}
			<p class="hint">
				{#if fetchedAt}
					Remotes fetched {fetchedAt}.
				{:else}
					Remotes not fetched this session.
				{/if}
				{#if npmUser}
					npm {npmUser}.
				{:else if statusReady}
					npm not signed in — run <code>localhelm auth</code>.
				{/if}
			</p>

			<p class="heading spaced">Board</p>
			<div class="actions">
				{#if onRefresh || onPull || onPush || onToggleActivity}
					<div class="conn-dock">
						{#if onRefresh}
							<button type="button" class="item" disabled={Boolean(busy)} onclick={() => { close(); onRefresh(); }}>
								<Icon icon="lucide:refresh-cw" />
								Refresh
							</button>
						{/if}
						{#if onPull}
							<button type="button" class="item" disabled={Boolean(busy) || demoBoard} onclick={() => { close(); onPull(); }}>
								<Icon icon="lucide:git-pull-request" />
								Pull
							</button>
						{/if}
						{#if onPush}
							<button type="button" class="item" disabled={Boolean(busy) || demoBoard} onclick={() => { close(); onPush(); }}>
								<Icon icon="lucide:upload" />
								Push
							</button>
						{/if}
						{#if onToggleActivity}
							<button type="button" class="item" onclick={() => { close(); onToggleActivity(); }}>
								<Icon icon="lucide:scroll-text" />
								{activityOpen ? 'Close activity' : 'Activity'}
								{#if activityBadge}
									<span class="id">{activityBadge}</span>
								{/if}
							</button>
						{/if}
					</div>
				{/if}
				<a class="item" href="/deck" onclick={close}>
					<Icon icon="lucide:layout-grid" />
					Deck
				</a>
				<button type="button" class="item" disabled={!statusReady} onclick={() => { close(); onCopyBrief(); }}>
					<Icon icon="lucide:clipboard" />
					{briefCopied ? 'Copied brief' : 'Copy brief'}
				</button>
				<button type="button" class="item" disabled={busy || demoBoard} onclick={() => { close(); onFetchRemotes(); }}>
					<Icon icon="lucide:cloud-download" />
					Fetch remotes
				</button>
				<button type="button" class="item" disabled={busy || demoBoard} onclick={() => { close(); onExport(); }}>
					<Icon icon="lucide:file-json" />
					Write inventory JSON
				</button>
				{#if demoBoard && onClearDemo}
					<button type="button" class="item danger" disabled={busy} onclick={() => { close(); onClearDemo(); }}>
						<Icon icon="lucide:trash-2" />
						Clear demo
					</button>
				{/if}
			</div>

			<p class="heading spaced">Plugins</p>
			<p class="hint">Off plugins stay enrolled. Their tab and jobs hide until you turn them back on.</p>
			{#if plugins.length === 0}
				<p class="empty">None loaded. Enroll a project that has <code>localhelm.plugin.mjs</code>.</p>
			{:else}
				<ul>
					{#each plugins as plug (plug.id)}
						<li>
							<label class="row">
								<input
									type="checkbox"
									checked={plug.enabled}
									disabled={busy}
									onchange={(event) => onToggle(plug.id, event.currentTarget.checked)}
								/>
								<span class="copy">
									<span class="name">{plug.label}</span>
									<span class="id">{plug.id}</span>
								</span>
							</label>
						</li>
					{/each}
				</ul>
			{/if}
		</div>
	{/if}
</div>

<style>
	.helm-menu {
		position: relative;
	}

	.panel {
		--hud-fill: var(--well);
		position: absolute;
		top: calc(100% + 0.4rem);
		right: 0;
		z-index: 40;
		width: min(22.5rem, calc(100vw - 2rem));
		padding: 0.65rem 0.75rem 0.7rem;
		border: 1px solid var(--cyan-dim);
		background: var(--well);
		border-radius: var(--plate-radius);
		box-shadow: 0 0.6rem 1.4rem rgb(0 0 0 / 0.45), 0 0 18px var(--cyan-glow);
	}

	.heading {
		margin: 0;
		font-size: 0.68rem;
		letter-spacing: 0.1em;
		text-transform: uppercase;
		color: var(--cyan, #b4b4bc);
	}

	.heading.spaced {
		margin-top: 0.65rem;
		padding-top: 0.55rem;
		border-top: 1px solid var(--steel);
	}

	.hint,
	.empty,
	.meta {
		margin: 0.28rem 0 0;
		color: var(--dim, #b4b4bc);
		font-size: 0.78rem;
		line-height: 1.35;
	}

	.pills {
		display: flex;
		margin-top: 0.4rem;
		border: 1px solid var(--steel);
		border-radius: 999px;
		overflow: hidden;
		background: var(--void, #0c0c10);
	}

	.pill {
		flex: 1;
		padding: 0.28rem 0.55rem;
		border: 0;
		background: none;
		color: var(--dim);
		font: inherit;
		font-size: 0.72rem;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		cursor: pointer;
	}

	.pill.on {
		background: rgb(201 162 39 / 0.18);
		color: var(--gold-soft);
	}

	.pill:not(.on):hover:not(:disabled) {
		background: rgb(126 244 255 / 0.08);
		color: #ececef;
	}

	.pill:disabled {
		opacity: 0.42;
		cursor: not-allowed;
	}

	.path {
		display: flex;
		align-items: center;
		gap: 0.4rem;
		width: 100%;
		padding: 0;
		border: 0;
		background: none;
		color: inherit;
		text-align: left;
		cursor: pointer;
	}

	.path code {
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		font-size: 0.72rem;
	}

	.copy-hint {
		flex-shrink: 0;
		color: var(--dim);
		font-size: 0.68rem;
	}

	.actions {
		display: grid;
		gap: 0.05rem;
		margin-top: 0.3rem;
	}

	.conn-dock {
		display: none;
	}

	@media (max-width: 64rem) {
		.conn-dock {
			display: contents;
		}

		.panel {
			max-height: min(70dvh, 36rem);
			overflow: auto;
			width: min(22.5rem, calc(100vw - 1.25rem));
		}
	}

	.item {
		display: flex;
		align-items: center;
		gap: 0.45rem;
		width: 100%;
		padding: 0.32rem 0.4rem;
		border: 0;
		border-radius: var(--plate-radius-sm, 0 0 5px 5px);
		background: none;
		color: #ececef;
		font-size: 0.84rem;
		text-align: left;
		text-decoration: none;
		cursor: pointer;
	}

	.item:hover:not(:disabled) {
		background: rgb(126 244 255 / 0.08);
	}

	.item.danger {
		color: #fca5a5;
	}

	.item.danger:hover:not(:disabled) {
		background: rgb(239 68 68 / 0.1);
	}

	.item:disabled {
		opacity: 0.42;
		cursor: not-allowed;
	}

	ul {
		list-style: none;
		margin: 0.4rem 0 0;
		padding: 0;
		display: grid;
		gap: 0.1rem;
	}

	.row {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.28rem 0.4rem;
		border-radius: var(--plate-radius-sm, 0 0 5px 5px);
		cursor: pointer;
	}

	.row:hover {
		background: rgb(126 244 255 / 0.08);
	}

	.row input {
		margin: 0;
		flex-shrink: 0;
	}

	.copy {
		display: grid;
		gap: 0.05rem;
		min-width: 0;
	}

	.name {
		color: #ececef;
		font-size: 0.84rem;
		line-height: 1.2;
	}

	.id {
		color: var(--dim);
		font-size: 0.7rem;
		font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
		line-height: 1.2;
	}
</style>
