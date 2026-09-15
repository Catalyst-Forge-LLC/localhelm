<script lang="ts">
	import Icon from './Icon.svelte';
	import Tooltip from './Tooltip.svelte';

	let {
		icon,
		label,
		title = label,
		pressed = false,
		hot = false,
		disabled = false,
		badge = '',
		compact = false,
		onclick,
	}: {
		icon: string;
		label: string;
		title?: string;
		pressed?: boolean;
		hot?: boolean;
		disabled?: boolean;
		badge?: string | number;
		compact?: boolean;
		onclick: () => void;
	} = $props();
</script>

<Tooltip {title}>
<button
	type="button"
	class="icon-btn"
	class:pressed
	class:hot
	class:compact
	{disabled}
	aria-label={label}
	aria-pressed={pressed}
	{onclick}
>
	<Icon {icon} />
	{#if badge !== '' && badge !== 0}
		<span class="badge">{badge}</span>
	{/if}
</button>
</Tooltip>

<style>
	.icon-btn {
		position: relative;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 2.15rem;
		height: 2.15rem;
		padding: 0;
		border: 1px solid var(--steel, #5a5a64);
		background: var(--well, #3c3c44);
		color: #ececef;
		border-radius: var(--plate-radius-sm, 0 0 5px 5px);
		font-size: 1.05rem;
		cursor: pointer;
		transition:
			background-color var(--hud-fade, 0.125s) ease,
			border-color var(--hud-fade, 0.125s) ease,
			box-shadow var(--hud-fade, 0.125s) ease,
			color var(--hud-fade, 0.125s) ease;
	}

	.icon-btn:hover:not(:disabled) {
		border-color: var(--cyan-dim, #8b8b93);
		background: rgb(126 244 255 / 0.08);
	}

	.icon-btn.pressed {
		border-color: var(--gold, #c9a227);
		background: rgb(201 162 39 / 0.16);
		color: var(--gold-soft, #fde68a);
	}

	.icon-btn.hot:not(.pressed) {
		border-color: var(--gold, #c9a227);
		color: var(--gold-soft, #fde68a);
	}

	.icon-btn:disabled {
		opacity: 0.42;
		cursor: not-allowed;
	}

	.icon-btn.compact {
		width: 1.35rem;
		height: 1.35rem;
		font-size: 0.8rem;
	}

	.badge {
		position: absolute;
		top: -0.35rem;
		right: -0.35rem;
		min-width: 1rem;
		padding: 0 0.28rem;
		border: 1px solid var(--steel);
		background: var(--hull-2);
		border-radius: var(--plate-radius-sm);
		color: var(--cyan);
		font-size: 0.62rem;
		line-height: 1.15rem;
		text-align: center;
	}

	.hot .badge,
	.pressed .badge {
		border-color: var(--gold);
		background: var(--gold-soft);
		color: var(--hull);
		font-weight: 600;
	}

	@media (prefers-reduced-motion: reduce) {
		.icon-btn {
			transition: none;
		}
	}
</style>
