<script lang="ts">
	import {
		VISITOR_FAVICON_FILES,
		visitorFaviconCandidates,
		visitorTileLetter,
	} from '../../../src/lib/loopback.js';

	const OPEN_TARGET = 'localhelm-open';

	let {
		name,
		port,
		href,
		iconHref = null,
		title = null,
	}: {
		name: string;
		port: number;
		href: string | null;
		iconHref?: string | null;
		title?: string | null;
	} = $props();

	const letter = $derived(visitorTileLetter(name));
	const heading = $derived(title?.trim() || name);
	const iconBase = $derived(iconHref ?? href);
	const candidates = $derived(iconBase ? visitorFaviconCandidates(iconBase) : [...VISITOR_FAVICON_FILES].map((file) => `/${file}`));
	let iconIndex = $state(0);
	let broken = $state(false);
	let iconReady = $state(false);
	let copied = $state(false);
	let copiedTimer = $state<ReturnType<typeof setTimeout> | null>(null);
	let pressTimer = $state<ReturnType<typeof setTimeout> | null>(null);
	let held = false;

	$effect(() => {
		void candidates;
		iconIndex = 0;
		broken = false;
		iconReady = false;
	});

	const favicon = $derived(!broken && iconIndex < candidates.length ? (candidates[iconIndex] ?? null) : null);

	async function copyUrl() {
		if (!href) return;
		try {
			await navigator.clipboard.writeText(href);
		} catch {
			return;
		}
		held = true;
		if (copiedTimer) clearTimeout(copiedTimer);
		copied = true;
		copiedTimer = setTimeout(() => {
			copied = false;
		}, 1200);
	}

	function clearPress() {
		if (pressTimer) clearTimeout(pressTimer);
		pressTimer = null;
	}

	function onPointerDown(event: PointerEvent) {
		if (!href) return;
		if (event.pointerType === 'mouse' && event.button !== 0) return;
		held = false;
		clearPress();
		pressTimer = setTimeout(() => {
			void copyUrl();
		}, 500);
	}

	function onClick(event: MouseEvent) {
		if (!held) return;
		event.preventDefault();
		held = false;
	}

	function markIfCached(node: HTMLImageElement) {
		if (node.complete && node.naturalWidth > 0) iconReady = true;
	}

	function onContextMenu(event: MouseEvent) {
		if (!href) return;
		event.preventDefault();
		void copyUrl();
	}
</script>

{#snippet face()}
	<span class="face">
		<span class="icon" aria-hidden="true">
			{#if !iconReady}{letter}{/if}
			{#if favicon && !broken}
				<img
					src={favicon}
					alt=""
					onload={() => {
						iconReady = true;
					}}
					{@attach markIfCached}
					onerror={() => {
						iconReady = false;
						if (iconIndex + 1 < candidates.length) iconIndex += 1;
						else broken = true;
					}}
				/>
			{/if}
		</span>
		<span class="title">{copied ? 'Copied' : heading}</span>
	</span>
	<span class="band">:{port}</span>
{/snippet}

{#if href}
	<a
		class="tile"
		{href}
		target={OPEN_TARGET}
		rel="noopener"
		aria-label="Open {heading}"
		onpointerdown={onPointerDown}
		onpointerup={clearPress}
		onpointercancel={clearPress}
		onpointerleave={clearPress}
		onclick={onClick}
		oncontextmenu={onContextMenu}
	>
		{@render face()}
	</a>
{:else}
	<div class="tile">{@render face()}</div>
{/if}

<style>
	.tile {
		--edge: var(--cyan-dim, #3a5a70);
		--tick: 0.7rem;
		display: flex;
		min-height: 9.5rem;
		flex-direction: column;
		overflow: hidden;
		border: 1px solid var(--steel, #3a3a42);
		border-radius: var(--plate-radius, 0 0 5px 5px);
		background:
			linear-gradient(var(--edge), var(--edge)) top left / var(--tick) 1px no-repeat,
			linear-gradient(var(--edge), var(--edge)) top left / 1px var(--tick) no-repeat,
			linear-gradient(var(--edge), var(--edge)) top right / var(--tick) 1px no-repeat,
			linear-gradient(var(--edge), var(--edge)) top right / 1px var(--tick) no-repeat,
			linear-gradient(var(--edge), var(--edge)) bottom left / var(--tick) 1px no-repeat,
			linear-gradient(var(--edge), var(--edge)) bottom left / 1px var(--tick) no-repeat,
			linear-gradient(var(--edge), var(--edge)) bottom right / var(--tick) 1px no-repeat,
			linear-gradient(var(--edge), var(--edge)) bottom right / 1px var(--tick) no-repeat,
			var(--well, #2a2a32);
		color: #ececef;
		text-decoration: none;
		text-align: center;
		box-shadow: 0 4px 14px rgba(0, 0, 0, 0.28);
		user-select: none;
		-webkit-touch-callout: none;
	}
	a.tile:hover {
		background:
			linear-gradient(var(--edge), var(--edge)) top left / var(--tick) 1px no-repeat,
			linear-gradient(var(--edge), var(--edge)) top left / 1px var(--tick) no-repeat,
			linear-gradient(var(--edge), var(--edge)) top right / var(--tick) 1px no-repeat,
			linear-gradient(var(--edge), var(--edge)) top right / 1px var(--tick) no-repeat,
			linear-gradient(var(--edge), var(--edge)) bottom left / var(--tick) 1px no-repeat,
			linear-gradient(var(--edge), var(--edge)) bottom left / 1px var(--tick) no-repeat,
			linear-gradient(var(--edge), var(--edge)) bottom right / var(--tick) 1px no-repeat,
			linear-gradient(var(--edge), var(--edge)) bottom right / 1px var(--tick) no-repeat,
			rgb(126 244 255 / 0.06);
	}
	.face {
		display: flex;
		flex: 1;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 0.5rem;
		padding: 1rem 0.75rem 0.75rem;
	}
	.icon {
		position: relative;
		display: flex;
		size: 3rem;
		width: 3rem;
		height: 3rem;
		align-items: center;
		justify-content: center;
		overflow: hidden;
		border-radius: var(--plate-radius, 0 0 5px 5px);
		background: rgb(126 244 255 / 0.06);
		font-size: 1.1rem;
		font-weight: 600;
		color: var(--dim, #b4b4bc);
	}
	.icon img {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		object-fit: contain;
	}
	.title {
		width: 100%;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		font-size: 0.875rem;
		font-weight: 500;
	}
	.band {
		display: flex;
		min-height: 1.75rem;
		width: 100%;
		align-items: center;
		justify-content: center;
		background: var(--well, #111114);
		border-top: 1px solid var(--cyan-dim, #2e2e36);
		color: var(--cyan, #ececef);
		font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
		font-size: 0.875rem;
	}
</style>
