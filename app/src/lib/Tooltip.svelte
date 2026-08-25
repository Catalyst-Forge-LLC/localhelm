<script lang="ts">
	import { onMount } from 'svelte';
	import type { Instance, Placement } from 'tippy.js';

	function appendToBody(): HTMLElement {
		return document.body;
	}

	const TOOLTIP_Z_INDEX = 80;

	let {
		title,
		placement = 'top',
		delay = 80,
		interactive = false,
		wide = false,
		children,
	}: {
		title: string;
		placement?: Placement;
		delay?: number | [number, number];
		interactive?: boolean;
		wide?: boolean;
		children: import('svelte').Snippet;
	} = $props();

	const theme = $derived(wide ? 'helm helm-wide' : 'helm');
	let el: HTMLSpanElement | undefined;
	let instance = $state<Instance | null>(null);

	function applyProps(): void {
		instance?.setProps({
			content: title,
			placement,
			delay,
			theme,
			interactive,
			appendTo: appendToBody,
			zIndex: TOOLTIP_Z_INDEX,
		});
	}

	onMount(() => {
		let cancelled = false;
		let tip: Instance | null = null;
		void import('tippy.js').then(({ default: tippy }) => {
			if (cancelled || !el || !title.trim()) return;
			tip = tippy(el, {
				content: title,
				placement,
				delay,
				arrow: true,
				theme,
				interactive,
				appendTo: appendToBody,
				zIndex: TOOLTIP_Z_INDEX,
			});
			instance = tip;
			applyProps();
		});
		return () => {
			cancelled = true;
			tip?.destroy();
			instance = null;
		};
	});

	$effect(() => {
		void title;
		void placement;
		void delay;
		void theme;
		void interactive;
		void instance;
		if (!title.trim()) {
			instance?.disable();
			return;
		}
		instance?.enable();
		applyProps();
	});
</script>

<span class="contents">
	<span bind:this={el} class="tip-ref">
		{@render children()}
	</span>
</span>

<style>
	.tip-ref {
		display: inline-flex;
		max-width: 100%;
		align-items: center;
	}

	.tip-ref :global(button:disabled) {
		pointer-events: none;
	}
</style>
