<script lang="ts">
	import { onMount } from 'svelte';
	import VisitorTile from '$lib/VisitorTile.svelte';
	import { isLoopbackBind, visitorFaviconHost, visitorHttpUrl } from '../../../src/lib/loopback.js';
	import type { VisitorSnapshot } from '../../../src/lib/visitorTiles.js';

	let {
		initial,
		pageHost,
	}: {
		initial: VisitorSnapshot;
		pageHost: string | null;
	} = $props();

	let feed = $state<VisitorSnapshot | null>(null);
	const snapshot = $derived(feed ?? initial);
	const iconHost = $derived(visitorFaviconHost(pageHost, snapshot.addresses));

	async function copy(value: string) {
		try {
			await navigator.clipboard.writeText(value);
		} catch {
			/* ignore */
		}
	}

	onMount(() => {
		const id = setInterval(() => {
			void fetch('/api/visitor')
				.then((res) => (res.ok ? res.json() : null))
				.then((body: VisitorSnapshot | null) => {
					if (body?.tiles) feed = body;
				});
		}, 8000);
		return () => clearInterval(id);
	});
</script>

<div class="visit helm-chart">
	<header class="hud-frame">
		<img class="mark" src="/logo.png" alt="" width="72" height="48" />
		<span class="word">Deck</span>
		{#if pageHost && isLoopbackBind(pageHost)}
			<a class="meta" href="/">Operator board</a>
		{/if}
		{#if snapshot.hostname}
			<button type="button" class="meta" onclick={() => copy(snapshot.hostname)}>{snapshot.hostname}</button>
		{/if}
		{#each snapshot.addresses as addr}
			<span class="dot" aria-hidden="true">·</span>
			<button type="button" class="meta" onclick={() => copy(addr)}>{addr}</button>
		{/each}
	</header>
	<main>
		{#if snapshot.tiles.length === 0}
			<p class="empty">
				The Deck is empty. Nothing listening past loopback. Start a site on all interfaces, or
				claim with <code>localslip … --lan</code>.
			</p>
		{:else}
			<div class="grid">
				{#each snapshot.tiles as tile (tile.name)}
					<VisitorTile
						name={tile.name}
						port={tile.port}
						title={tile.title}
						href={pageHost ? visitorHttpUrl(pageHost, tile.port) : null}
						iconHref={iconHost ? visitorHttpUrl(iconHost, tile.port) : null}
					/>
				{/each}
			</div>
		{/if}
	</main>
	<footer>
		<span>Catalyst Forge, LLC</span>
		<a href="https://localhelm.dev" rel="noopener">localhelm.dev</a>
	</footer>
</div>

<style>
	.visit {
		min-height: 100dvh;
		display: flex;
		flex-direction: column;
	}
	header {
		--hud-fill: var(--glass-fill);
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.55rem 0.75rem;
		padding: 0.65rem 1.1rem;
		border: 0;
		border-bottom: 1px solid var(--cyan-dim);
		border-radius: 0;
		backdrop-filter: var(--glass-blur);
		-webkit-backdrop-filter: var(--glass-blur);
		box-shadow: 0 1px 18px var(--cyan-glow);
	}
	.mark {
		display: block;
		height: 2.4rem;
		width: auto;
	}
	.word {
		font-weight: 600;
		letter-spacing: 0.14em;
		text-transform: uppercase;
		color: var(--cyan, #ececef);
		text-shadow: 0 0 10px var(--cyan-glow, transparent);
	}
	.meta,
	.dot {
		border: 0;
		background: none;
		color: var(--dim, rgba(255, 255, 255, 0.72));
		font: inherit;
		font-size: 0.8rem;
		letter-spacing: 0.04em;
		padding: 0;
	}
	.meta {
		cursor: pointer;
		text-decoration: none;
	}
	.meta:hover {
		color: var(--cyan, #fff);
	}
	main {
		flex: 1;
		padding: 1rem 1.1rem 1.4rem;
	}
	.grid {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 0.75rem;
	}
	@media (min-width: 640px) {
		.grid {
			grid-template-columns: repeat(3, minmax(0, 1fr));
		}
	}
	.empty {
		margin: 0;
		color: var(--dim, #b4b4bc);
		font-size: 0.9rem;
		line-height: 1.45;
	}
	.empty code {
		color: var(--cyan, #ececef);
	}
	footer {
		display: flex;
		justify-content: space-between;
		gap: 1rem;
		padding: 0.7rem 1.1rem;
		padding-bottom: max(0.7rem, env(safe-area-inset-bottom));
		border-top: 1px solid var(--steel, #2e2e36);
		color: var(--dim, #8b8b93);
		font-size: 0.8rem;
	}
	footer a {
		color: inherit;
	}
</style>
