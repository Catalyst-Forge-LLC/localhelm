<script lang="ts">
	import { onMount } from 'svelte';
	import type { Instance, Placement } from 'tippy.js';
	import { helmTippyProps } from './helmTippy';

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

	let el: HTMLSpanElement | undefined;
	let instance = $state<Instance | null>(null);

	function applyProps(): void {
		instance?.setProps(
			helmTippyProps({
				content: title,
				placement,
				delay,
				interactive,
				wide,
			}),
		);
	}

	onMount(() => {
		let cancelled = false;
		let tip: Instance | null = null;
		void import('tippy.js').then(({ default: tippy }) => {
			if (cancelled || !el || !title.trim()) return;
			tip = tippy(el, helmTippyProps({ content: title, placement, delay, interactive, wide }));
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
		void interactive;
		void wide;
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

	/* Let hover hit the wrapper so a disabled control still shows the tip. */
	.tip-ref :global(button:disabled),
	.tip-ref :global(a[aria-disabled='true']) {
		pointer-events: none;
	}
</style>
