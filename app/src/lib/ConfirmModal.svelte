<script lang="ts">
	import type { Snippet } from 'svelte';

	type Props = {
		open: boolean;
		title: string;
		hint?: string;
		confirmLabel?: string;
		cancelLabel?: string;
		variant?: 'write' | 'danger';
		busy?: boolean;
		items?: string[];
		children?: Snippet;
		onconfirm: () => void;
		oncancel?: () => void;
	};

	let {
		open = $bindable(),
		title,
		hint = '',
		confirmLabel = 'Confirm',
		cancelLabel = 'Cancel',
		variant = 'write',
		busy = false,
		items = [],
		children,
		onconfirm,
		oncancel,
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
		oncancel?.();
	}

	function confirm(event: MouseEvent): void {
		event.preventDefault();
		event.stopPropagation();
		if (busy) return;
		onconfirm();
	}
</script>

<dialog
	bind:this={dialogEl}
	class="confirm"
	aria-labelledby="confirm-title"
	onclose={() => {
		if (busy) {
			dialogEl?.showModal();
			return;
		}
		if (open) {
			open = false;
			oncancel?.();
		}
	}}
	onkeydown={(event) => {
		if (event.key === 'Escape' && busy) event.preventDefault();
	}}
>
	<div class="body">
		<h2 id="confirm-title">{title}</h2>
		{#if hint}
			<p class="hint">{hint}</p>
		{/if}
		{#if items.length}
			<ul>
				{#each items as item, i (`${i}:${item}`)}
					<li>{item}</li>
				{/each}
			</ul>
		{/if}
		{#if children}
			<div class="extra">{@render children()}</div>
		{/if}
		<div class="actions">
			<button type="button" class="btn" disabled={busy} onclick={cancel}>{cancelLabel}</button>
			<button
				type="button"
				class="btn"
				class:danger={variant === 'danger'}
				class:write={variant === 'write'}
				disabled={busy}
				onclick={confirm}
			>
				{busy ? 'Working… look for a LocalHelm publish window' : confirmLabel}
			</button>
		</div>
	</div>
</dialog>

<style>
	.confirm {
		border: 1px solid #3f3f46;
		border-radius: 0.75rem;
		background: #18181b;
		color: #e4e4e7;
		padding: 0;
		max-width: 32rem;
		width: calc(100% - 2rem);
		box-shadow: 0 24px 48px rgb(0 0 0 / 0.55);
	}

	.confirm::backdrop {
		background: rgb(0 0 0 / 0.62);
	}

	.body {
		padding: 1.15rem 1.25rem 1.1rem;
	}

	h2 {
		margin: 0;
		font-size: 1.02rem;
		font-weight: 600;
	}

	.hint {
		margin: 0.4rem 0 0;
		color: #a1a1aa;
		font-size: 0.82rem;
		line-height: 1.4;
	}

	ul {
		margin: 0.75rem 0 0;
		padding: 0.55rem 0.7rem;
		max-height: 14rem;
		overflow: auto;
		list-style: none;
		border: 1px solid #27272a;
		border-radius: 0.45rem;
		background: #09090b;
		font-size: 0.78rem;
		font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
		line-height: 1.45;
	}

	li + li {
		margin-top: 0.25rem;
	}

	.extra {
		margin-top: 0.75rem;
	}

	.actions {
		display: flex;
		justify-content: flex-end;
		flex-wrap: wrap;
		gap: 0.4rem;
		margin-top: 1rem;
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

	.btn.write {
		border-color: #854d0e;
		background: #422006;
		color: #fde68a;
	}

	.btn.danger {
		border-color: #991b1b;
		background: #7f1d1d;
		color: #fecaca;
	}
</style>
