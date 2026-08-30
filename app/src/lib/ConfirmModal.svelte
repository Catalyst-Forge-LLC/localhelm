<script lang="ts">
	import type { Snippet } from 'svelte';
	import Icon from './Icon.svelte';

	type Phase = 'pending' | 'current' | 'done' | 'fail';

	type Props = {
		open: boolean;
		title: string;
		hint?: string;
		confirmLabel?: string;
		cancelLabel?: string;
		variant?: 'write' | 'danger';
		busy?: boolean;
		busyLabel?: string;
		canApply?: boolean;
		items?: string[];
		itemPhases?: Phase[];
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
		busyLabel = '',
		canApply = true,
		items = [],
		itemPhases = [],
		children,
		onconfirm,
		oncancel,
	}: Props = $props();

	const showPhases = $derived(itemPhases.some((phase) => phase !== 'pending'));

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

	function itemLink(item: string): { before: string; href: string; after: string } | null {
		const match = /(https:\/\/[^\s]+)/.exec(item);
		if (!match?.[1] || match.index == null) return null;
		return {
			before: item.slice(0, match.index),
			href: match[1],
			after: item.slice(match.index + match[1].length),
		};
	}
</script>

<dialog
	bind:this={dialogEl}
	class="confirm"
	aria-labelledby="confirm-title"
	onclose={() => {
		if (!open) return;
		if (busy) {
			dialogEl?.showModal();
			return;
		}
		open = false;
		oncancel?.();
	}}
	onkeydown={(event) => {
		if (event.key === 'Escape' && busy) event.preventDefault();
	}}
>
	<div class="panel">
	<div class="body">
		<h2 id="confirm-title">{title}</h2>
		{#if hint}
			<p class="hint">{hint}</p>
		{/if}
		{#if items.length}
			<ul class:tracked={showPhases}>
				{#each items as item, i (`${i}:${item}`)}
					{@const phase = itemPhases[i] ?? 'pending'}
					{@const link = itemLink(item)}
					<li class:current={phase === 'current'} class:done={phase === 'done'} class:fail={phase === 'fail'}>
						{#if showPhases}
							<span class="mark" aria-hidden="true">
								{#if phase === 'done'}
									<Icon icon="lucide:check" />
								{:else if phase === 'fail'}
									<Icon icon="lucide:x" />
								{:else if phase === 'current'}
									<Icon icon="lucide:loader-circle" class="icon spin" />
								{:else}
									<span class="dot"></span>
								{/if}
							</span>
						{/if}
						<span>
							{#if link}
								{link.before}<a href={link.href} target="_blank" rel="noopener noreferrer">{link.href}</a>{link.after}
							{:else}
								{item}
							{/if}
						</span>
					</li>
				{/each}
			</ul>
		{/if}
		{#if children}
			<div class="extra">{@render children()}</div>
		{/if}
		<div class="actions">
			<button type="button" class="btn" disabled={busy} onclick={cancel}>{canApply ? cancelLabel : 'Close'}</button>
			{#if canApply}
				<button
					type="button"
					class="btn"
					class:danger={variant === 'danger'}
					class:write={variant === 'write'}
					disabled={busy}
					onclick={confirm}
				>
					{busy ? busyLabel || 'Working…' : confirmLabel}
				</button>
			{/if}
		</div>
	</div>
	</div>
</dialog>

<style>
	.confirm {
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

	.confirm:not([open]) {
		display: none;
	}

	.confirm[open] {
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.panel {
		width: min(36rem, calc(100vw - 2rem));
		max-width: 100%;
		max-height: calc(100dvh - 2rem);
		overflow-x: hidden;
		overflow-y: auto;
		border: 1px solid #3f3f46;
		border-radius: 0.75rem;
		background: #18181b;
		color: #e4e4e7;
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
		min-width: 0;
		overflow-x: hidden;
		overflow-y: auto;
		list-style: none;
		border: 1px solid #27272a;
		border-radius: 0.45rem;
		background: #09090b;
		font-size: 0.78rem;
		font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
		line-height: 1.45;
	}

	li {
		display: flex;
		align-items: flex-start;
		gap: 0.45rem;
		min-width: 0;
		white-space: pre-wrap;
		overflow-wrap: anywhere;
	}

	li a {
		color: #fbbf24;
		text-decoration: underline;
		text-underline-offset: 0.12em;
	}

	.tracked li.current {
		color: #fde68a;
	}

	.tracked li.done {
		color: #a7f3d0;
	}

	.tracked li.fail {
		color: #fca5a5;
	}

	.mark {
		flex-shrink: 0;
		width: 0.9rem;
		margin-top: 0.12rem;
		color: inherit;
	}

	.dot {
		display: block;
		width: 0.38rem;
		height: 0.38rem;
		margin: 0.26rem auto 0;
		border-radius: 999px;
		background: #52525b;
	}

	:global(.spin) {
		animation: spin 0.8s linear infinite;
	}

	@keyframes spin {
		to {
			transform: rotate(360deg);
		}
	}

	li + li {
		margin-top: 0.55rem;
		padding-top: 0.45rem;
		border-top: 1px solid #27272a;
	}

	.extra {
		margin-top: 0.75rem;
		min-width: 0;
		overflow-wrap: anywhere;
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
		max-width: 100%;
		white-space: normal;
		text-align: right;
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
