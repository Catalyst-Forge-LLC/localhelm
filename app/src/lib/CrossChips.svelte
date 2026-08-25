<script lang="ts">
	import Tooltip from './Tooltip.svelte';
	import type { CrossChip } from './crosswalk';

	let {
		chips,
		onOpen,
	}: {
		chips: CrossChip[];
		onOpen: (kind: CrossChip['kind']) => void;
	} = $props();
</script>

{#if chips.length}
	<div class="chips">
		{#each chips as chip (chip.kind)}
			<Tooltip title={`Opens the ${chip.label} board with this id.`}>
				<button type="button" class="xchip" onclick={() => onOpen(chip.kind)}>{chip.label}</button>
			</Tooltip>
		{/each}
	</div>
{/if}

<style>
	.chips {
		display: flex;
		flex-wrap: wrap;
		gap: 0.25rem;
		margin-top: 0.2rem;
	}
	.xchip {
		margin: 0;
		padding: 0.05rem 0.4rem;
		border: 1px solid #5a5a64;
		border-radius: 999px;
		background: #32323a;
		color: #d4d4d8;
		font: inherit;
		font-size: 0.68rem;
		cursor: pointer;
	}
	.xchip:hover {
		border-color: #c9a227;
		color: #fde68a;
	}
</style>
