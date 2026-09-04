<script lang="ts">
	import Icon from './Icon.svelte';

	let { label = 'Reading…', showLabel = false }: { label?: string; showLabel?: boolean } = $props();
</script>

<span class="cell-wait" aria-busy="true">
	<Icon icon="lucide:loader-circle" class="icon spin" />
	{#if showLabel}
		<span>{label}</span>
	{:else}
		<span class="visually-hidden">{label}</span>
	{/if}
</span>

<style>
	.cell-wait {
		display: inline-flex;
		align-items: center;
		gap: 0.4rem;
		color: #a1a1aa;
	}

	:global(.spin) {
		animation: spin 0.8s linear infinite;
	}

	@keyframes spin {
		to {
			transform: rotate(360deg);
		}
	}

	.visually-hidden {
		position: absolute;
		width: 1px;
		height: 1px;
		overflow: hidden;
		clip: rect(0 0 0 0);
	}
</style>
