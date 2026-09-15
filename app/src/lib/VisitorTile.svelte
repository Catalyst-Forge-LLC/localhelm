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
		class="tile hud-frame"
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
	<div class="tile hud-frame">{@render face()}</div>
{/if}

<style>
	.tile {
		--tick: 0.7rem;
		--hud-fill: var(--glass-fill);
		display: flex;
		min-height: 9.5rem;
		flex-direction: column;
		overflow: hidden;
		border: 1px solid var(--steel);
		color: #ececef;
		text-decoration: none;
		text-align: center;
		backdrop-filter: var(--glass-blur);
		-webkit-backdrop-filter: var(--glass-blur);
		box-shadow:
			inset 0 1px 0 rgb(126 244 255 / 0.2),
			0 8px 20px rgb(0 0 0 / 0.32),
			0 0 16px rgb(126 244 255 / 0.1);
		transition:
			transform var(--hud-fade) ease,
			border-color var(--hud-fade) ease,
			box-shadow var(--hud-fade) ease,
			background-color var(--hud-fade) ease;
		user-select: none;
		-webkit-touch-callout: none;
	}
	a.tile:hover {
		--hud-fill: rgb(18 36 58 / 0.62);
		transform: translateY(-0.22rem);
		border-color: var(--cyan-dim);
		box-shadow: var(--overlay-glow), inset 0 1px 0 rgb(126 244 255 / 0.35);
	}
	a.tile:hover .face {
		background: linear-gradient(180deg, rgb(126 244 255 / 0.2) 0%, rgb(201 162 39 / 0.06) 72%, transparent 100%);
	}
	a.tile:hover .band {
		color: var(--gold-soft);
		border-top-color: rgb(201 162 39 / 0.45);
		box-shadow: 0 0 14px rgb(201 162 39 / 0.18);
	}
	.face {
		display: flex;
		flex: 1;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 0.5rem;
		padding: 1rem 0.75rem 0.75rem;
		background: linear-gradient(180deg, rgb(126 244 255 / 0.14) 0%, rgb(6 10 19 / 0.08) 68%, transparent 100%);
		transition: background var(--hud-fade) ease;
	}
	.icon {
		position: relative;
		display: flex;
		width: 3rem;
		height: 3rem;
		align-items: center;
		justify-content: center;
		overflow: hidden;
		border-radius: var(--plate-radius);
		background: rgb(126 244 255 / 0.1);
		box-shadow: 0 0 12px rgb(126 244 255 / 0.12);
		font-size: 1.1rem;
		font-weight: 600;
		color: var(--dim);
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
		background: rgb(3 6 12 / 0.45);
		border-top: 1px solid var(--cyan-dim);
		color: var(--cyan);
		transition:
			color var(--hud-fade) ease,
			border-color var(--hud-fade) ease,
			box-shadow var(--hud-fade) ease;
		font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
		font-size: 0.875rem;
	}

	@media (prefers-reduced-motion: reduce) {
		.tile,
		.face,
		.band {
			transition: none;
		}

		a.tile:hover {
			transform: none;
		}
	}
</style>
