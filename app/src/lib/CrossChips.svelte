<script lang="ts">
	import Tooltip from './Tooltip.svelte';
	import type { CrossChip } from './crosswalk';

	let {
		chips,
		onOpen,
		compact = false,
	}: {
		chips: CrossChip[];
		onOpen: (kind: CrossChip['kind']) => void;
		compact?: boolean;
	} = $props();

	function chipTip(kind: CrossChip['kind']): string {
		if (kind === 'fleet') return 'Opens Fleet and checks this package.';
		if (kind === 'sites') return 'Opens FilePress Sites and checks this site.';
		return 'Opens LocalSlip Ports and checks this lease.';
	}
</script>

{#if chips.length}
	<div class="chips" class:compact>
		{#if !compact}
			<span class="also">also on</span>
		{/if}
		{#each chips as chip (chip.kind)}
			<Tooltip title={chipTip(chip.kind)}>
				<button type="button" class="xchip" onclick={() => onOpen(chip.kind)}>{chip.label}</button>
			</Tooltip>
		{/each}
	</div>
{/if}

<style>
	.chips {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.25rem;
		margin-top: 0.2rem;
	}

	.also {
		font-size: 0.62rem;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		color: #8b8b93;
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

	.chips.compact {
		margin-top: 0;
		flex-wrap: nowrap;
	}
</style>
