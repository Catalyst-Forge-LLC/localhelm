<script lang="ts">
	import { onMount } from 'svelte';
	import type { Snippet } from 'svelte';
	import Icon from './Icon.svelte';

	let {
		label = 'More',
		align = 'end',
		children,
	}: {
		label?: string;
		align?: 'start' | 'end';
		children: Snippet;
	} = $props();

	let open = $state(false);
	let rootEl = $state<HTMLDivElement | null>(null);

	function close(): void {
		open = false;
	}

	onMount(() => {
		function onPointer(event: PointerEvent): void {
			if (!open || !rootEl) return;
			if (event.target instanceof Node && rootEl.contains(event.target)) return;
			close();
		}
		function onClick(event: MouseEvent): void {
			if (!open || !rootEl) return;
			const target = event.target;
			if (!(target instanceof Element) || !rootEl.contains(target)) return;
			const button = target.closest('button');
			const trigger = rootEl.querySelector(':scope > button');
			if (button && button !== trigger) close();
		}
		function onKey(event: KeyboardEvent): void {
			if (event.key === 'Escape') close();
		}
		document.addEventListener('pointerdown', onPointer);
		document.addEventListener('click', onClick);
		document.addEventListener('keydown', onKey);
		return () => {
			document.removeEventListener('pointerdown', onPointer);
			document.removeEventListener('click', onClick);
			document.removeEventListener('keydown', onKey);
		};
	});
</script>

<div class="overflow" bind:this={rootEl}>
	<button type="button" class="btn" aria-haspopup="true" aria-expanded={open} onclick={() => (open = !open)}>
		{label}
		<Icon icon="lucide:chevron-down" />
	</button>
	{#if open}
		<div class="menu" class:end={align === 'end'}>
			{@render children()}
		</div>
	{/if}
</div>

<style>
	.overflow {
		position: relative;
	}

	.menu {
		position: absolute;
		top: calc(100% + 0.3rem);
		left: 0;
		z-index: 40;
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
		min-width: 12.5rem;
		padding: 0.35rem;
		border: 1px solid var(--steel);
		background: var(--hull, #0c1218);
		border-radius: var(--plate-radius, 6px);
		box-shadow: 0 8px 24px rgb(0 0 0 / 0.35);
	}

	.menu.end {
		right: 0;
		left: auto;
	}

	.menu :global(.btn) {
		width: 100%;
		justify-content: flex-start;
	}
</style>
