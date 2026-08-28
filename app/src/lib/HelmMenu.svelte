<script lang="ts">
	import { onMount } from 'svelte';
	import Icon from './Icon.svelte';
	import IconButton from './IconButton.svelte';

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
	} = $props();

	let open = $state(false);
	let copiedPath = $state(false);
	let rootEl = $state<HTMLDivElement | null>(null);

	function close(): void {
		open = false;
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
		<div class="panel" role="menu" aria-label="LocalHelm menu">
			<p class="heading">This board</p>
			{#if fleetPath}
				<p class="meta">
					<button type="button" class="path" title="Copy fleet path" onclick={() => void copyFleetPath()}>
						<code>{fleetPath}</code>
						<span class="copy-hint">{copiedPath ? 'copied' : 'copy'}</span>
					</button>
				</p>
			{:else if statusReady}
				<p class="hint">No fleet yet — open the Fleet tab, scan a folder, then enroll.</p>
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
				<a class="item" href="/visitor" onclick={close}>
					<Icon icon="lucide:layout-grid" />
					Visitor tiles
				</a>
				<button type="button" class="item" disabled={!statusReady} onclick={() => { close(); onCopyBrief(); }}>
					<Icon icon="lucide:clipboard" />
					{briefCopied ? 'Copied brief' : 'Copy brief'}
				</button>
				<button type="button" class="item" disabled={busy} onclick={() => { close(); onFetchRemotes(); }}>
					<Icon icon="lucide:cloud-download" />
					Fetch remotes
				</button>
				<button type="button" class="item" disabled={busy} onclick={() => { close(); onExport(); }}>
					<Icon icon="lucide:file-json" />
					Write inventory JSON
				</button>
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
		position: absolute;
		top: calc(100% + 0.4rem);
		right: 0;
		z-index: 40;
		width: min(24rem, calc(100vw - 2rem));
		padding: 0.75rem 0.85rem 0.85rem;
		border: 1px solid #5a5a64;
		background: #2c2c32;
		border-radius: 0.6rem;
		box-shadow: 0 0.6rem 1.4rem rgb(0 0 0 / 0.35);
	}

	.heading {
		margin: 0;
		font-size: 0.72rem;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: #b4b4bc;
	}

	.heading.spaced {
		margin-top: 0.85rem;
	}

	.hint,
	.empty,
	.meta {
		margin: 0.4rem 0 0;
		color: #b4b4bc;
		font-size: 0.82rem;
		line-height: 1.35;
	}

	.path {
		display: flex;
		align-items: center;
		gap: 0.5rem;
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
		font-size: 0.75rem;
	}

	.copy-hint {
		flex-shrink: 0;
		color: #9a9aa3;
		font-size: 0.72rem;
	}

	.actions {
		display: grid;
		gap: 0.2rem;
		margin-top: 0.45rem;
	}

	.item {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		width: 100%;
		padding: 0.4rem 0.45rem;
		border: 0;
		border-radius: 0.4rem;
		background: none;
		color: #ececef;
		font-size: 0.88rem;
		text-align: left;
		text-decoration: none;
		cursor: pointer;
	}

	.item:hover:not(:disabled) {
		background: #3a3a42;
	}

	.item:disabled {
		opacity: 0.42;
		cursor: not-allowed;
	}

	ul {
		list-style: none;
		margin: 0.65rem 0 0;
		padding: 0;
		display: grid;
		gap: 0.35rem;
	}

	.row {
		display: flex;
		align-items: flex-start;
		gap: 0.55rem;
		padding: 0.4rem 0.45rem;
		border-radius: 0.4rem;
		cursor: pointer;
	}

	.row:hover {
		background: #3a3a42;
	}

	.row input {
		margin-top: 0.2rem;
	}

	.copy {
		display: grid;
		gap: 0.1rem;
		min-width: 0;
	}

	.name {
		color: #ececef;
		font-size: 0.92rem;
	}

	.id {
		color: #9a9aa3;
		font-size: 0.75rem;
		font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
	}
</style>
