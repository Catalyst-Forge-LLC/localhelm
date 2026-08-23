<script lang="ts">
	import type { Snippet } from 'svelte';

	type Props = {
		open: boolean;
		busy?: boolean;
		children?: Snippet;
	};

	let { open = $bindable(), busy = false, children }: Props = $props();

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
	aria-labelledby="add-projects-title"
	onclose={() => {
		if (busy) {
			dialogEl?.showModal();
			return;
		}
		if (open) open = false;
	}}
	onkeydown={(event) => {
		if (event.key === 'Escape' && busy) event.preventDefault();
	}}
>
	<div class="panel">
		<div class="head">
			<div>
				<h2 id="add-projects-title">Add projects</h2>
				<p class="hint">Scanning proposes folders. Nothing joins the fleet until you tick it and write.</p>
			</div>
			<button type="button" class="btn" disabled={busy} onclick={cancel}>Close</button>
		</div>
		<div class="body">
			{#if children}{@render children()}{/if}
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
		background: rgb(0 0 0 / 0.62);
	}

	.panel {
		width: min(40rem, 100%);
		max-height: calc(100dvh - 2rem);
		display: flex;
		flex-direction: column;
		border: 1px solid #3f3f46;
		border-radius: 0.75rem;
		background: #18181b;
		color: #e4e4e7;
		box-shadow: 0 24px 48px rgb(0 0 0 / 0.55);
	}

	.head {
		display: flex;
		flex-wrap: wrap;
		align-items: flex-start;
		justify-content: space-between;
		gap: 0.75rem;
		padding: 1.15rem 1.25rem 0.75rem;
		flex-shrink: 0;
	}

	h2 {
		margin: 0;
		font-size: 1.02rem;
		font-weight: 600;
	}

	.hint {
		margin: 0.35rem 0 0;
		color: #c4c4cc;
		font-size: 0.82rem;
		line-height: 1.4;
	}

	.body {
		padding: 0 1.25rem 1.15rem;
		overflow: auto;
		min-height: 0;
	}

	.btn {
		border: 1px solid #3f3f46;
		background: #27272a;
		color: #e4e4e7;
		border-radius: 0.4rem;
		padding: 0.35rem 0.7rem;
		font-size: 0.82rem;
		cursor: pointer;
	}

	.btn:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}
</style>
