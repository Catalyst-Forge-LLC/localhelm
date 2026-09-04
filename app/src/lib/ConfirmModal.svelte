<script lang="ts">
	import type { Snippet } from 'svelte';
	import { buildConfirmRoster, confirmRosterSelected } from './confirmRoster';
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
		itemKeys?: string[];
		itemPhases?: Phase[];
		failNote?: string;
		messageById?: Record<string, string>;
		draftHint?: string;
		children?: Snippet;
		onconfirm: () => void;
		oncancel?: () => void;
		ondraft?: (id: string) => void;
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
		itemKeys = [],
		itemPhases = [],
		failNote = '',
		messageById = $bindable<Record<string, string>>({}),
		draftHint = '',
		children,
		onconfirm,
		oncancel,
		ondraft,
	}: Props = $props();

	const showPhases = $derived(itemPhases.some((phase) => phase !== 'pending'));
	const groups = $derived(buildConfirmRoster(items, itemKeys, itemPhases));
	const liveId = $derived(
		groups?.find((group) => group.phase === 'current')?.id ??
			groups?.find((group) => group.phase === 'fail')?.id ??
			null,
	);

	let pinned = $state<string | null>(null);
	let rosterEl = $state<HTMLElement | null>(null);
	let stepListEl = $state<HTMLElement | null>(null);
	const rosterSig = $derived(`${items.join('\n')}\0${itemKeys.join('\n')}`);

	$effect(() => {
		rosterSig;
		pinned = null;
	});

	const selectedId = $derived(groups ? confirmRosterSelected(groups, pinned) : null);
	const selected = $derived(groups?.find((group) => group.id === selectedId) ?? null);
	const draftIds = $derived(Object.keys(messageById));
	const draftId = $derived(selectedId ?? draftIds[0] ?? '');
	const draftsReady = $derived(draftIds.length === 0 || draftIds.every((id) => Boolean(messageById[id]?.trim())));

	$effect(() => {
		const id = selectedId;
		if (!id || !rosterEl) return;
		const row = rosterEl.querySelector(`[data-roster="${CSS.escape(id)}"]`);
		row?.scrollIntoView({ block: 'nearest' });
	});

	$effect(() => {
		if (!stepListEl) return;
		const current = stepListEl.querySelector('li.current');
		current?.scrollIntoView({ block: 'nearest' });
	});

	function pick(id: string): void {
		pinned = id === liveId ? null : id;
	}

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

	function phaseMark(phase: Phase) {
		if (phase === 'done') return { icon: 'lucide:check' as const, spin: false };
		if (phase === 'fail') return { icon: 'lucide:x' as const, spin: false };
		if (phase === 'current') return { icon: 'lucide:loader-circle' as const, spin: true };
		return null;
	}
</script>

<dialog
	bind:this={dialogEl}
	class="confirm"
	class:wide={Boolean(groups)}
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
		{#if groups && selected}
			<div class="split">
				<div class="roster" bind:this={rosterEl} role="listbox" aria-label="Packages">
					{#each groups as group (group.id)}
						<button
							type="button"
							class="roster-row"
							class:on={group.id === selectedId}
							class:current={group.phase === 'current'}
							class:done={group.phase === 'done'}
							class:fail={group.phase === 'fail'}
							data-roster={group.id}
							role="option"
							aria-selected={group.id === selectedId}
							onclick={() => pick(group.id)}
						>
							<span class="mark" aria-hidden="true">
								{#if phaseMark(group.phase)}
									{@const mark = phaseMark(group.phase)!}
									<Icon icon={mark.icon} class={mark.spin ? 'icon spin' : 'icon'} />
								{:else}
									<span class="dot"></span>
								{/if}
							</span>
							<span class="name">{group.id}</span>
							{#if group.phase === 'current'}
								<span class="now">now</span>
							{/if}
							{#if group.total > 1}
								<span class="count">{group.done}/{group.total}</span>
							{/if}
						</button>
					{/each}
				</div>
				<ol class="steps" class:tracked={showPhases} bind:this={stepListEl}>
					{#each selected.steps as step, i (`${selected.id}:${i}:${step.text}`)}
						{@const link = itemLink(step.text)}
						<li class:current={step.phase === 'current'} class:done={step.phase === 'done'} class:fail={step.phase === 'fail'}>
							{#if showPhases}
								<span class="mark" aria-hidden="true">
									{#if phaseMark(step.phase)}
										{@const mark = phaseMark(step.phase)!}
										<Icon icon={mark.icon} class={mark.spin ? 'icon spin' : 'icon'} />
									{:else}
										<span class="dot"></span>
									{/if}
								</span>
							{/if}
							<span>
								{#if link}
									{link.before}<a href={link.href} target="_blank" rel="noopener noreferrer">{link.href}</a>{link.after}
								{:else}
									{step.text}
								{/if}
							</span>
						</li>
					{/each}
				</ol>
			</div>
		{:else if items.length}
			<ul class:tracked={showPhases}>
				{#each items as item, i (`${i}:${item}`)}
					{@const phase = itemPhases[i] ?? 'pending'}
					{@const link = itemLink(item)}
					<li class:current={phase === 'current'} class:done={phase === 'done'} class:fail={phase === 'fail'}>
						{#if showPhases}
							<span class="mark" aria-hidden="true">
								{#if phaseMark(phase)}
									{@const mark = phaseMark(phase)!}
									<Icon icon={mark.icon} class={mark.spin ? 'icon spin' : 'icon'} />
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
		{#if failNote}
			<p class="fail-note">{failNote}</p>
		{/if}
		{#if children}
			<div class="extra">{@render children()}</div>
		{/if}
		{#if draftId && draftIds.length}
			<label class="draft" for="confirm-draft">
				Commit message{#if draftIds.length > 1}
					<span class="draft-id">{draftId}</span>
				{/if}
			</label>
			{#if draftHint}
				<p class="draft-hint">{draftHint}</p>
			{/if}
			<textarea
				id="confirm-draft"
				rows="4"
				disabled={busy}
				value={messageById[draftId] ?? ''}
				oninput={(event) => {
					messageById = { ...messageById, [draftId]: event.currentTarget.value };
					ondraft?.(draftId);
				}}
			></textarea>
		{/if}
		<div class="actions">
			<button type="button" class="btn" disabled={busy} onclick={cancel}>{canApply ? cancelLabel : 'Close'}</button>
			{#if canApply}
				<button
					type="button"
					class="btn"
					class:danger={variant === 'danger'}
					class:write={variant === 'write'}
					disabled={busy || !draftsReady}
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
		display: flex;
		flex-direction: column;
		width: min(36rem, calc(100vw - 2rem));
		max-width: 100%;
		max-height: calc(100dvh - 2rem);
		overflow: hidden;
		border: 1px solid #3f3f46;
		border-radius: 0.75rem;
		background: #18181b;
		color: #e4e4e7;
		box-shadow: 0 24px 48px rgb(0 0 0 / 0.55);
	}

	.wide .panel {
		width: min(48rem, calc(100vw - 2rem));
	}

	.confirm::backdrop {
		background: rgb(0 0 0 / 0.62);
	}

	.body {
		display: flex;
		flex-direction: column;
		min-height: 0;
		flex: 1;
		padding: 1.15rem 1.25rem 1.1rem;
	}

	h2 {
		flex-shrink: 0;
		margin: 0;
		font-size: 1.02rem;
		font-weight: 600;
	}

	.hint {
		flex-shrink: 0;
		margin: 0.4rem 0 0;
		color: #a1a1aa;
		font-size: 0.82rem;
		line-height: 1.4;
	}

	.split {
		display: grid;
		grid-template-columns: minmax(10.5rem, 13.5rem) minmax(0, 1fr);
		gap: 0.55rem;
		margin: 0.75rem 0 0;
		min-height: 0;
		flex: 1 1 auto;
		height: min(22rem, calc(100dvh - 16rem));
	}

	.roster,
	ul,
	ol.steps {
		margin: 0;
		padding: 0.45rem;
		min-width: 0;
		min-height: 0;
		overflow-x: hidden;
		overflow-y: auto;
		list-style: none;
		border: 1px solid #27272a;
		border-radius: 0.45rem;
		background: #09090b;
	}

	ul {
		margin: 0.75rem 0 0;
		padding: 0.55rem 0.7rem;
		max-height: 14rem;
		font-size: 0.78rem;
		font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
		line-height: 1.45;
	}

	ol.steps {
		padding: 0.55rem 0.7rem;
		font-size: 0.78rem;
		font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
		line-height: 1.45;
	}

	.roster-row {
		display: flex;
		align-items: center;
		gap: 0.4rem;
		width: 100%;
		margin: 0;
		padding: 0.35rem 0.4rem;
		border: 0;
		border-radius: 0.35rem;
		background: transparent;
		color: #d4d4d8;
		font: inherit;
		font-size: 0.8rem;
		text-align: left;
		cursor: pointer;
	}

	.roster-row + .roster-row {
		margin-top: 0.15rem;
	}

	.roster-row:hover {
		background: #18181b;
	}

	.roster-row.on {
		background: #27272a;
		color: #fafafa;
	}

	.roster-row.current {
		color: #fde68a;
	}

	.roster-row.done {
		color: #a7f3d0;
	}

	.roster-row.fail {
		color: #fca5a5;
	}

	.roster-row .name {
		flex: 1;
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.now,
	.count {
		flex-shrink: 0;
		font-size: 0.68rem;
		color: #a1a1aa;
	}

	.roster-row.current .now {
		color: #fde68a;
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

	.fail-note {
		margin: 0.65rem 0 0;
		color: #fca5a5;
		font-size: 0.8rem;
		line-height: 1.4;
		overflow-wrap: anywhere;
	}

	.mark {
		flex-shrink: 0;
		width: 0.9rem;
		margin-top: 0.12rem;
		color: inherit;
	}

	.roster-row .mark {
		margin-top: 0;
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

	.draft {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: 0.6rem;
		margin: 0.85rem 0 0.3rem;
		font-size: 0.78rem;
		color: #a1a1aa;
	}

	.draft-id {
		color: #e4e4e7;
		font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
	}

	.draft-hint {
		margin: 0 0 0.35rem;
		font-size: 0.75rem;
		color: #a1a1aa;
	}

	textarea {
		display: block;
		width: 100%;
		min-height: 5.2rem;
		box-sizing: border-box;
		resize: vertical;
		border: 1px solid #3f3f46;
		border-radius: 0.4rem;
		background: #09090b;
		color: #e4e4e7;
		padding: 0.45rem 0.55rem;
		font: inherit;
		font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
		font-size: 0.78rem;
		line-height: 1.4;
	}

	textarea:focus {
		outline: 1px solid #854d0e;
	}

	.actions {
		display: flex;
		justify-content: flex-end;
		flex-wrap: wrap;
		flex-shrink: 0;
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

	@media (max-width: 36rem) {
		.split {
			grid-template-columns: 1fr;
			height: min(26rem, calc(100dvh - 14rem));
		}

		.roster {
			max-height: 9rem;
		}
	}
</style>
