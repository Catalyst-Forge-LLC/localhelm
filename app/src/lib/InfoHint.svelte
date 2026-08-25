<script lang="ts">
	import Icon from './Icon.svelte';
	import Tooltip from './Tooltip.svelte';

	let { summary, detail = '' }: { summary: string; detail?: string } = $props();
</script>

<p class="hint info-hint">
	{summary}
	{#if detail.trim()}
		<Tooltip wide interactive title={detail}>
			<button type="button" class="info-btn" aria-label="More about this board">
				<Icon icon="lucide:circle-help" />
			</button>
		</Tooltip>
	{/if}
</p>

<style>
	.info-hint {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.35rem;
		margin: 0.15rem 0 0;
	}

	.info-btn {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		margin: 0;
		padding: 0.05rem;
		border: 0;
		background: none;
		color: #8b8b93;
		font-size: 0.95rem;
		cursor: help;
	}

	.info-btn:hover {
		color: #fde68a;
	}
</style>
