<script lang="ts">
	import type { Snippet } from 'svelte';
	import { commitDraftProgressHint } from './confirmProgress';
	import { buildConfirmRoster, confirmCountText, confirmRosterSelected } from './confirmRoster';
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
		/** Subject ids this confirm would write (repos, sites, leases). Omit skips. */
		applyIds?: string[];
		excludedIds?: string[];
		failNote?: string;
		messageById?: Record<string, string>;
		draftHint?: string;
		draftingIds?: string[];
		draftNoteById?: Record<string, string>;
		children?: Snippet;
		onconfirm: (includedIds: string[]) => void;
		onalt?: (includedIds: string[]) => void;
		oncancel?: () => void;
		onstop?: () => void;
		ondraft?: (id: string) => void;
		altLabel?: string;
		/** Multi-id apply is running; Stop finishes the current item and skips the rest. */
		canStop?: boolean;
		stopping?: boolean;
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
		applyIds = [],
		excludedIds = $bindable<string[]>([]),
		failNote = '',
		messageById = $bindable<Record<string, string>>({}),
		draftHint = '',
		draftingIds = [],
		draftNoteById = {},
		children,
		onconfirm,
		onalt,
		oncancel,
		onstop,
		ondraft,
		altLabel = '',
		canStop = false,
		stopping = false,
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
		excludedIds = [];
	});

	const selectedId = $derived(groups ? confirmRosterSelected(groups, pinned) : null);
	const selected = $derived(groups?.find((group) => group.id === selectedId) ?? null);
	const draftIds = $derived(Object.keys(messageById));
	const draftId = $derived(selectedId ?? draftIds[0] ?? '');
	const applyPool = $derived(applyIds.length ? applyIds : (groups?.map((group) => group.id) ?? []));
	const includedApply = $derived(applyPool.filter((id) => !excludedIds.includes(id)));
	const canExclude = $derived(Boolean(groups && groups.length >= 2 && applyIds.length >= 2));
	const displayTitle = $derived(canExclude ? confirmCountText(title, includedApply.length, applyPool.length) : title);
	const displayLabel = $derived(
		canExclude ? confirmCountText(confirmLabel, includedApply.length, applyPool.length) : confirmLabel,
	);
	const displayHint = $derived(
		canExclude
			? [hint, 'Uncheck a name to leave it out of this confirm.']
					.filter(Boolean)
					.join(' ')
			: hint,
	);
	const draftsReady = $derived(
		draftIds.filter((id) => !excludedIds.includes(id)).every((id) => Boolean(messageById[id]?.trim())),
	);
	const liveDraftHint = $derived(
		draftingIds.length || Object.keys(draftNoteById).length
			? commitDraftProgressHint({
					ids: draftIds.length ? draftIds : draftingIds,
					pending: draftingIds,
					selected: draftId || undefined,
					notes: draftNoteById,
				})
			: draftHint,
	);

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

	function setIncluded(id: string, on: boolean): void {
		if (busy) return;
		excludedIds = on ? excludedIds.filter((item) => item !== id) : [...new Set([...excludedIds, id])];
	}

	let dialogEl = $state<HTMLDialogElement | null>(null);

	$effect(() => {
		if (!dialogEl) return;
		if (open && !dialogEl.open) dialogEl.showModal();
		else if (!open && dialogEl.open) dialogEl.close();
	});

	function cancel(): void {
		if (busy) {
			if (canStop && !stopping) onstop?.();
			return;
		}
		open = false;
		oncancel?.();
	}

	function stop(): void {
		if (!canStop || stopping) return;
		onstop?.();
	}

	function confirm(event: MouseEvent): void {
		event.preventDefault();
		event.stopPropagation();
		if (busy) return;
		onconfirm(includedApply);
	}

	function alt(event: MouseEvent): void {
		event.preventDefault();
		event.stopPropagation();
		if (busy) return;
		onalt?.(includedApply);
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
			if (canStop && !stopping) onstop?.();
			return;
		}
		open = false;
		oncancel?.();
	}}
	onkeydown={(event) => {
		if (event.key === 'Escape' && busy) {
			event.preventDefault();
			if (canStop && !stopping) onstop?.();
		}
	}}
>
	<div class="panel hud-frame">
	<div class="body">
		<h2 id="confirm-title">{displayTitle}</h2>
		{#if displayHint}
			<p class="hint">{displayHint}</p>
		{/if}
		{#if busy && busyLabel}
			<div class="working" class:solo={!items.length} role="status" aria-live="polite">
				<span class="working-copy">{busyLabel}</span>
				<span class="hud-scan" aria-hidden="true"><span class="hud-scan-blob"></span></span>
			</div>
		{/if}
		{#if groups && selected}
			<div class="split">
				<div class="roster" bind:this={rosterEl} role="listbox" aria-label="Items in this confirm">
					{#each groups as group (group.id)}
						<div
							class="roster-row"
							class:on={group.id === selectedId}
							class:out={excludedIds.includes(group.id)}
							class:current={group.phase === 'current'}
							class:done={group.phase === 'done'}
							class:fail={group.phase === 'fail'}
							data-roster={group.id}
							role="option"
							aria-selected={group.id === selectedId}
						>
							{#if canExclude && applyPool.includes(group.id)}
								<label class="include">
									<input
										type="checkbox"
										checked={!excludedIds.includes(group.id)}
										disabled={busy}
										aria-label={`Include ${group.id}`}
										onchange={(event) => setIncluded(group.id, event.currentTarget.checked)}
									/>
								</label>
							{/if}
							<button type="button" class="pick" onclick={() => pick(group.id)}>
								<span class="mark" aria-hidden="true">
									{#if phaseMark(group.phase)}
										{@const mark = phaseMark(group.phase)!}
										<Icon icon={mark.icon} class={mark.spin ? 'icon spin' : 'icon'} />
									{:else if draftingIds.includes(group.id)}
										<Icon icon="lucide:loader-circle" class="icon spin" />
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
						</div>
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
			{#if liveDraftHint}
				<p class="draft-hint">{liveDraftHint}</p>
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
			<button
				type="button"
				class="btn"
				disabled={busy && (!canStop || stopping)}
				onclick={busy && canStop ? stop : cancel}
			>
				{busy && canStop ? (stopping ? 'Stopping…' : 'Stop') : canApply ? cancelLabel : 'Close'}
			</button>
			{#if canApply && altLabel && onalt}
				<button type="button" class="btn" disabled={busy || !draftsReady} onclick={alt}>{altLabel}</button>
			{/if}
			{#if canApply}
				<button
					type="button"
					class="btn"
					class:danger={variant === 'danger'}
					class:write={variant === 'write'}
					disabled={busy || !draftsReady || (canExclude && includedApply.length === 0)}
					onclick={confirm}
				>
					{busy ? 'Working…' : displayLabel}
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
		--hud-fill: var(--hull);
		display: flex;
		flex-direction: column;
		width: min(36rem, calc(100vw - 2rem));
		max-width: 100%;
		max-height: calc(100dvh - 2rem);
		overflow: hidden;
		border: 1px solid var(--steel);
		border-radius: var(--plate-radius);
		background: var(--hull);
		color: #ececef;
		box-shadow: var(--overlay-glow);
	}

	.wide .panel {
		width: min(48rem, calc(100vw - 2rem));
	}

	.confirm::backdrop {
		background: rgb(3 6 12 / 0.78);
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
		color: var(--dim);
		font-size: 0.82rem;
		line-height: 1.4;
	}

	.working {
		display: flex;
		flex-direction: column;
		align-items: stretch;
		gap: 0.4rem;
		flex-shrink: 0;
		margin: 0.75rem 0 0;
		color: #ececef;
		font-size: 0.88rem;
		line-height: 1.4;
	}

	.working.solo {
		min-height: 3.25rem;
		padding: 0.35rem 0 0.15rem;
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
		border: 1px solid var(--steel);
		border-radius: var(--plate-radius);
		background: var(--well);
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
		gap: 0.2rem;
		width: 100%;
		margin: 0;
		padding: 0.1rem 0.15rem 0.1rem 0.25rem;
		border-radius: var(--plate-radius-sm);
		color: #ececef;
		transition:
			background-color var(--hud-fade) ease,
			box-shadow var(--hud-fade) ease;
	}

	.roster-row + .roster-row {
		margin-top: 0.15rem;
	}

	.roster-row.on {
		background: rgb(126 244 255 / 0.08);
		color: var(--cyan);
	}

	.roster-row.out {
		opacity: 0.48;
	}

	.roster-row.out .name {
		text-decoration: line-through;
	}

	.include {
		display: flex;
		align-items: center;
		flex-shrink: 0;
		margin: 0;
		padding: 0.2rem 0.15rem;
		cursor: pointer;
	}

	.include input {
		margin: 0;
		accent-color: var(--gold);
	}

	.pick {
		display: flex;
		align-items: center;
		gap: 0.4rem;
		flex: 1;
		min-width: 0;
		margin: 0;
		padding: 0.25rem 0.25rem 0.25rem 0.1rem;
		border: 0;
		border-radius: var(--plate-radius-sm);
		background: transparent;
		color: inherit;
		font: inherit;
		font-size: 0.8rem;
		text-align: left;
		cursor: pointer;
	}

	.pick:hover {
		background: rgb(201 162 39 / 0.12);
	}

	.roster-row.on .pick:hover {
		background: transparent;
	}

	.roster-row.current {
		color: var(--gold-soft);
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
		color: var(--dim);
	}

	.roster-row.current .now {
		color: var(--gold-soft);
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
		color: var(--gold);
		text-decoration: underline;
		text-underline-offset: 0.12em;
	}

	.tracked li.current {
		color: var(--gold-soft);
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
		background: var(--steel);
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
		border-top: 1px solid var(--hairline);
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
		color: var(--dim);
	}

	.draft-id {
		color: #ececef;
		font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
	}

	.draft-hint {
		margin: 0 0 0.35rem;
		font-size: 0.75rem;
		color: var(--dim);
	}

	textarea {
		display: block;
		width: 100%;
		min-height: 5.2rem;
		box-sizing: border-box;
		resize: vertical;
		border: 1px solid var(--steel);
		border-radius: var(--plate-radius);
		background: var(--well);
		color: #ececef;
		padding: 0.45rem 0.55rem;
		font: inherit;
		font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
		font-size: 0.78rem;
		line-height: 1.4;
	}

	textarea:focus {
		outline: 1px solid var(--gold);
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
		border: 1px solid var(--steel);
		background: var(--well);
		color: #ececef;
		border-radius: var(--plate-radius);
		padding: 0.35rem 0.7rem;
		font-size: 0.82rem;
		cursor: pointer;
		max-width: 100%;
		white-space: normal;
		text-align: right;
		transition:
			background-color var(--hud-fade) ease,
			border-color var(--hud-fade) ease,
			box-shadow var(--hud-fade) ease,
			color var(--hud-fade) ease;
	}

	.btn:hover:not(:disabled) {
		border-color: var(--cyan-dim);
		background: rgb(126 244 255 / 0.08);
	}

	.btn:disabled {
		opacity: 0.42;
		cursor: not-allowed;
	}

	.btn.write {
		border-color: var(--gold);
		background: rgb(201 162 39 / 0.12);
		color: var(--gold-soft);
	}

	.btn.write:hover:not(:disabled) {
		background: rgb(201 162 39 / 0.22);
		box-shadow: 0 0 10px rgb(201 162 39 / 0.28);
	}

	.btn.danger {
		border-color: var(--alarm);
		background: rgb(248 113 113 / 0.16);
		color: #fecaca;
	}

	.btn.danger:hover:not(:disabled) {
		background: rgb(248 113 113 / 0.28);
		box-shadow: 0 0 10px rgb(248 113 113 / 0.28);
	}

	@media (prefers-reduced-motion: reduce) {
		.roster-row,
		.btn {
			transition: none;
		}
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
