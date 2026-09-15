<script lang="ts">
	import Tooltip from './Tooltip.svelte';
	import { activityMonthGroups, type ActivityDay } from './activityDays';

	let {
		days,
		selected = '',
		onpick,
	}: {
		days: ActivityDay[];
		selected?: string;
		onpick: (key: string) => void;
	} = $props();

	const months = $derived(activityMonthGroups(days));
</script>

<nav class="day-nav" aria-label="Jump to a day">
	{#if !days.length}
		<p class="empty">—</p>
	{:else}
		{#each months as month (month.key)}
			<p class="month">{month.label}</p>
			{#each month.days as day (day.key)}
				<Tooltip title="{day.label} · {day.count} {day.count === 1 ? 'write' : 'writes'}">
					<button
						type="button"
						class="day"
						class:on={day.key === selected}
						aria-current={day.key === selected ? 'date' : undefined}
						onclick={() => onpick(day.key)}
					>
						<span class="dom">{day.dom}</span>
						<span class="count">{day.count}</span>
					</button>
				</Tooltip>
			{/each}
		{/each}
	{/if}
</nav>

<style>
	.day-nav {
		display: flex;
		flex-direction: column;
		gap: 0.15rem;
		width: 4.4rem;
		flex-shrink: 0;
		min-height: 0;
		overflow: auto;
		padding: 0.15rem 0.2rem 0.35rem 0;
	}

	.day-nav :global(.tip-ref) {
		width: 100%;
	}

	.month,
	.empty {
		margin: 0.35rem 0 0.1rem;
		font-size: 0.58rem;
		letter-spacing: 0.12em;
		text-transform: uppercase;
		color: var(--dim);
	}

	.month:first-child {
		margin-top: 0;
	}

	.empty {
		margin: 0;
	}

	.day {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: 0.2rem;
		width: 100%;
		margin: 0;
		padding: 0.22rem 0.3rem;
		border: 1px solid transparent;
		border-radius: var(--plate-radius-sm);
		background: none;
		color: var(--dim);
		font: inherit;
		cursor: pointer;
		transition:
			background-color var(--hud-fade) ease,
			border-color var(--hud-fade) ease,
			color var(--hud-fade) ease;
	}

	.day:hover {
		background: rgb(126 244 255 / 0.08);
		color: #ececef;
	}

	.day.on {
		border-color: var(--cyan-dim);
		background: rgb(126 244 255 / 0.12);
		color: var(--cyan);
	}

	.dom {
		font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
		font-variant-numeric: tabular-nums;
		font-size: 0.78rem;
		font-weight: 600;
	}

	.count {
		font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
		font-size: 0.58rem;
		color: var(--steel);
	}

	.day.on .count {
		color: var(--cyan-dim);
	}

	@media (prefers-reduced-motion: reduce) {
		.day {
			transition: none;
		}
	}
</style>
