<script lang="ts">
	import type { Snippet } from 'svelte';
	import KnightRiderBar from './KnightRiderBar.svelte';

	type Props = {
		open: boolean;
		busy?: boolean;
		busyLabel?: string;
		title?: string;
		hint?: string;
		titleId?: string;
		children?: Snippet;
	};

	let {
		open = $bindable(),
		busy = false,
		busyLabel = '',
		title = 'Add projects',
		hint = 'Scan the folder that holds your repos — usually the same folder you ran serve from. Tick, then Add to fleet. That write is the confirm.',
		titleId = 'add-projects-title',
		children,
	}: Props = $props();

	let dialogEl = $state<HTMLDialogElement | null>(null);

	$effect(() => {
		if (!dialogEl) return;
		if (open && !dialogEl.open) dialogEl.showModal();
		else if (!open && dialogEl.open) dialogEl.close();
	});

	function cancel(): void {
		if (busy) return;
		open = false;
	}
</script>

<dialog
	bind:this={dialogEl}
	class="add"
	aria-labelledby={titleId}
	onclose={() => {
		if (!open) return;
		if (busy) {
			dialogEl?.showModal();
			return;
		}
		open = false;
	}}
	onkeydown={(event) => {
		if (event.key === 'Escape' && busy) event.preventDefault();
	}}
	onclick={(event) => {
		if (event.target === dialogEl) cancel();
	}}
>
	<div class="panel hud-frame">
		<div class="head">
			<div>
				<h2 id={titleId}>{title}</h2>
				<p class="hint">{hint}</p>
			</div>
		</div>
		<div class="body">
			{#if busy}
				<div class="working" role="status" aria-live="polite">
					<span class="working-copy">{busyLabel || 'Scanning…'}</span>
					<KnightRiderBar />
				</div>
			{/if}
			{#if children}{@render children()}{/if}
		</div>
		<div class="actions">
			<button type="button" class="btn" disabled={busy} onclick={cancel}>Close</button>
		</div>
	</div>
</dialog>

<style>
	.add {
		position: fixed;
		inset: 0;
		width: 100%;
		max-width: none;
		height: 100%;
		max-height: none;
		margin: 0;
		padding: 1rem;
		border: none;
		background: transparent;
		overflow: auto;
	}

	.add:not([open]) {
		display: none;
	}

	.add[open] {
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.add::backdrop {
		background: rgb(3 6 12 / 0.78);
	}

	.panel {
		--hud-fill: var(--hull);
		width: min(40rem, 100%);
		max-height: calc(100dvh - 2rem);
		display: flex;
		flex-direction: column;
		border: 1px solid var(--steel);
		border-radius: var(--plate-radius);
		background: var(--hull);
		color: #ececef;
		box-shadow: var(--overlay-glow);
	}

	.head {
		display: flex;
		flex-wrap: nowrap;
		align-items: flex-start;
		justify-content: space-between;
		gap: 0.75rem;
		padding: 1.15rem 1.25rem 0.75rem;
		flex-shrink: 0;
	}

	.head > div {
		min-width: 0;
		flex: 1;
	}

	h2 {
		margin: 0;
		font-size: 1.02rem;
		font-weight: 600;
	}

	.hint {
		margin: 0.35rem 0 0;
		color: var(--dim);
		font-size: 0.82rem;
		line-height: 1.4;
	}

	.body {
		padding: 0 1.25rem;
		overflow: auto;
		min-height: 0;
	}

	.actions {
		display: flex;
		justify-content: flex-end;
		flex-shrink: 0;
		gap: 0.4rem;
		padding: 0.85rem 1.25rem 1.15rem;
	}

	.working {
		display: flex;
		flex-direction: column;
		align-items: stretch;
		gap: 0.4rem;
		margin: 0 0 0.75rem;
		color: #ececef;
		font-size: 0.88rem;
		line-height: 1.4;
	}

	.btn {
		flex-shrink: 0;
		border: 1px solid var(--steel);
		background: var(--well);
		color: #ececef;
		border-radius: var(--plate-radius);
		padding: 0.35rem 0.7rem;
		font-size: 0.82rem;
		cursor: pointer;
		transition:
			background-color var(--hud-fade) ease,
			border-color var(--hud-fade) ease,
			box-shadow var(--hud-fade) ease;
	}

	.btn:hover:not(:disabled) {
		border-color: var(--cyan-dim);
		background: rgb(126 244 255 / 0.08);
	}

	.btn:disabled {
		opacity: 0.42;
		cursor: not-allowed;
	}

	@media (prefers-reduced-motion: reduce) {
		.btn {
			transition: none;
		}
	}
</style>
