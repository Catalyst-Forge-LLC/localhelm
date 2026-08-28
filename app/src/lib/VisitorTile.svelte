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
		title = null,
	}: {
		name: string;
		port: number;
		href: string | null;
		title?: string | null;
	} = $props();

	const letter = $derived(visitorTileLetter(name));
	const heading = $derived(title?.trim() || name);
	const candidates = $derived(href ? visitorFaviconCandidates(href) : [...VISITOR_FAVICON_FILES].map((file) => `/${file}`));
	let iconIndex = $state(0);
	let broken = $state(false);
	let copied = $state(false);
	let copiedTimer = $state<ReturnType<typeof setTimeout> | null>(null);
	let pressTimer = $state<ReturnType<typeof setTimeout> | null>(null);
	let held = false;

	$effect(() => {
		void candidates;
		iconIndex = 0;
		broken = false;
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

	function onContextMenu(event: MouseEvent) {
		if (!href) return;
		event.preventDefault();
		void copyUrl();
	}
</script>

{#snippet face()}
	<span class="face">
		<span class="icon" aria-hidden="true">
			{letter}
			{#if favicon && !broken}
				<img
					src={favicon}
					alt=""
					onerror={() => {
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
		display: flex;
		min-height: 9.5rem;
		flex-direction: column;
		overflow: hidden;
		border: 1px solid #3a3a42;
		border-radius: 10px;
		background: #2a2a32;
		color: #ececef;
		text-decoration: none;
		text-align: center;
		box-shadow: 0 4px 14px rgba(0, 0, 0, 0.28);
		user-select: none;
		-webkit-touch-callout: none;
	}
	a.tile:hover {
		background: #32323a;
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
		border-radius: 0.75rem;
		background: rgba(255, 255, 255, 0.06);
		font-size: 1.1rem;
		font-weight: 600;
		color: #b4b4bc;
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
		background: #111114;
		color: #ececef;
		font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
		font-size: 0.875rem;
	}
</style>
