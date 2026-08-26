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
		border: 1px solid #5a5a64;
		background: #3c3c44;
		color: #ececef;
		border-radius: 0.45rem;
		font-size: 1.05rem;
		cursor: pointer;
	}

	.icon-btn:hover:not(:disabled) {
		border-color: #8b8b93;
		background: #484850;
	}

	.icon-btn.pressed {
		border-color: #c9a227;
		background: #4a3a12;
		color: #fde68a;
	}

	.icon-btn.hot:not(.pressed) {
		border-color: #c9a227;
		color: #fde68a;
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
		border: 1px solid #8b8b93;
		background: #3a3a42;
		border-radius: 999px;
		color: #f4f4f5;
		font-size: 0.62rem;
		line-height: 1.15rem;
		text-align: center;
	}

	.hot .badge,
	.pressed .badge {
		border-color: #c9a227;
		background: #4a3a12;
		color: #fde68a;
	}
</style>
