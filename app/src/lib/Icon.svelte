<script lang="ts">
	import '$lib/icons';
	import Iconify from '@iconify/svelte/dist/OfflineIcon.svelte';

	let { icon, class: className = 'icon' }: { icon: string; class?: string } = $props();
</script>

<Iconify {icon} class={className} width="1em" height="1em" aria-hidden="true" />

<style>
	:global(.icon) {
		display: inline-block;
		flex-shrink: 0;
		width: 1em;
		height: 1em;
		vertical-align: -0.125em;
	}
</style>
