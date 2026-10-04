<script lang="ts">
	import { FEATURE_LABEL_LIMIT, labelPaperMeta, labelPaperRows, type FeatureLabelModel } from './featureLabel';

	type Props = {
		open: boolean;
		model: FeatureLabelModel | null;
		ticked: string[];
		queue?: { index: number; total: number } | null;
		busy?: boolean;
		busyLabel?: string;
		error?: string;
		onscan?: () => void;
		onupdate?: () => void;
		onnext?: () => void;
	};

	let {
		open = $bindable(),
		model,
		ticked = $bindable([]),
		queue = null,
		busy = false,
		busyLabel = '',
		error = '',
		onscan,
		onupdate,
		onnext,
	}: Props = $props();

	let dialogEl = $state<HTMLDialogElement | null>(null);

	const hasNext = $derived(Boolean(queue && queue.index < queue.total));
	const overLimit = $derived(ticked.length > FEATURE_LABEL_LIMIT);
	const canUpdate = $derived(Boolean(model && model.features.length > 0 && !overLimit && !busy));
	const ordered = $derived(
		model ? [...model.features].sort((a, b) => Number(b.selected) - Number(a.selected)) : [],
	);
	const picked = $derived(ordered.filter((row) => ticked.includes(row.id)));
	const paper = $derived(labelPaperRows(picked));
	const meta = $derived(labelPaperMeta(model?.card ?? null));

	$effect(() => {
		if (!dialogEl) return;
		if (open && !dialogEl.open) dialogEl.showModal();
		else if (!open && dialogEl.open) dialogEl.close();
	});

	function toggle(id: string, on: boolean): void {
		if (busy) return;
		ticked = on ? [...new Set([...ticked, id])] : ticked.filter((item) => item !== id);
	}

</script>

<dialog
	bind:this={dialogEl}
	class="label-dialog"
	aria-labelledby="feature-label-title"
	oncancel={(event) => {
		if (busy) {
			event.preventDefault();
			return;
		}
		open = false;
	}}
	onclose={() => {
		if (open && !busy) open = false;
	}}
>
	<div class="panel">
		<div class="body">
			<h2 id="feature-label-title">
				Label for {model?.repoId ?? 'repo'}{#if queue}&nbsp;· {queue.index} of {queue.total}{/if}
			</h2>
			<p class="hint">
				Tick up to 12. Update label writes the file. Scan refreshes the list.{#if hasNext}&nbsp;Next leaves this file alone.{/if}
			</p>
			{#if busy}
				<p class="working">{busyLabel || 'Working…'}</p>
			{/if}
			{#if model}
				<div class="stage">
					<section class="xfacts-label" aria-label="FeatureFacts label">
						<p class="mark"><span class="mark-lead">Feature</span><span class="mark-rest">Facts</span></p>
						<h3>{model.card?.name || model.repoId}</h3>
						<div class="serving">Serving size: one product</div>
						{#if meta.length}
							<div class="meta">
								{#each meta as item (item.label)}
									<span><strong>{item.label}</strong> {item.value}</span>
								{/each}
							</div>
						{/if}
						{#if paper.length}
							{#each paper as row, i (row.label)}
								<div class="row" class:stack={row.value.length > 32} class:thick={i === paper.length - 1}>
									<strong>{row.label}</strong>
									<span>{row.value}</span>
								</div>
							{/each}
						{:else}
							<div class="row thick"><strong>Selected</strong><span>Nothing selected.</span></div>
						{/if}
					</section>
					<div class="picker">
			{#if model && model.notes.length}
				<ul class="notes">
					{#each model.notes as note (note)}
						<li>{note}</li>
					{/each}
				</ul>
			{/if}
			{#if error}
				<p class="fail">{error}</p>
			{/if}
			{#if overLimit}
				<p class="fail">A label holds at most 12 capabilities. Untick down to 12.</p>
			{/if}
			{#if model && ordered.length}
				<p class="count">{ticked.length} of {ordered.length} ticked</p>
				<ul class="caps">
					{#each ordered as row (row.id)}
						<li>
							<label title={row.summary}>
								<input
									type="checkbox"
									checked={ticked.includes(row.id)}
									disabled={busy}
									onchange={(event) => toggle(row.id, event.currentTarget.checked)}
								/>
								<span>{row.name}</span>
							</label>
						</li>
					{/each}
				</ul>
			{:else if model}
				<p class="hint">Scan this repo to find capabilities.</p>
			{/if}
				</div>
				</div>
			{/if}
		</div>
		<div class="actions">
			<button type="button" class="btn" disabled={busy} onclick={() => (open = false)}>Close</button>
			{#if hasNext}
				<button type="button" class="btn" disabled={busy} onclick={() => onnext?.()}>Next</button>
			{/if}
			<button type="button" class="btn" disabled={busy || !model} onclick={() => onscan?.()}>Scan</button>
			<button type="button" class="btn btn-write" disabled={!canUpdate} onclick={() => onupdate?.()}>
				{busy ? 'Working…' : 'Update label'}
			</button>
		</div>
	</div>
</dialog>

<style>
	.label-dialog:not([open]) {
		display: none;
	}

	.label-dialog[open] {
		display: flex;
		align-items: center;
		justify-content: center;
		border: 0;
		padding: 0;
		background: transparent;
		max-width: none;
		max-height: none;
	}

	.label-dialog::backdrop {
		background: rgb(3 6 12 / 0.78);
	}

	.panel {
		display: flex;
		flex-direction: column;
		width: min(52rem, calc(100vw - 2rem));
		max-height: calc(100dvh - 2rem);
		overflow: hidden;
		border: 1px solid var(--steel);
		border-radius: var(--plate-radius);
		background: var(--hull);
		color: #ececef;
		box-shadow: var(--overlay-glow);
	}

	.body {
		min-height: 0;
		padding: 1.15rem 1.25rem 0.4rem;
	}

	h2 {
		margin: 0;
		font-size: 1.02rem;
		font-weight: 600;
	}

	.hint,
	.working,
	.count {
		margin: 0.45rem 0 0;
		color: var(--dim);
		font-size: 0.82rem;
		line-height: 1.4;
	}

	.stage {
		display: grid;
		gap: 1rem;
		margin-top: 0.85rem;
		align-items: start;
	}

	@media (min-width: 760px) {
		.stage {
			grid-template-columns: 20rem minmax(0, 1fr);
		}
	}

	.xfacts-label {
		box-sizing: border-box;
		background: #f8fafc;
		color: #101418;
		border: 4px solid #101418;
		padding: 1rem 1.05rem 1.15rem;
		font-family: 'IBM Plex Mono', ui-monospace, monospace;
		font-weight: 400;
	}

	.mark {
		margin: 0 0 0.4rem;
		font-family: Sora, sans-serif;
		font-weight: 800;
		font-size: 0.85rem;
		letter-spacing: 0.06em;
		line-height: 1;
		text-transform: uppercase;
	}

	.mark-lead {
		color: #818cf8;
	}

	.mark-rest {
		color: #101418;
	}

	.xfacts-label h3 {
		margin: 0;
		font-family: Sora, sans-serif;
		font-weight: 800;
		font-size: 1.55rem;
		letter-spacing: -0.03em;
		line-height: 1.1;
		color: #101418;
	}

	.serving {
		font-size: 0.72rem;
		line-height: 1.35;
		color: #5c6b7a;
		border-bottom: 10px solid #101418;
		padding: 0.4rem 0 0.5rem;
		margin-bottom: 0.35rem;
	}

	.meta {
		display: flex;
		flex-wrap: wrap;
		gap: 0.35rem 0.75rem;
		border-bottom: 5px solid #101418;
		padding: 0.45rem 0 0.55rem;
		margin-bottom: 0.35rem;
		font-size: 0.78rem;
	}

	.meta strong,
	.row strong {
		font-weight: 700;
	}

	.row {
		display: flex;
		justify-content: space-between;
		gap: 1rem;
		border-bottom: 1px solid #101418;
		padding: 0.32rem 0;
		font-size: 0.8rem;
	}

	.row.thick {
		border-bottom-width: 5px;
	}

	.row span {
		text-align: right;
	}

	.row.stack {
		flex-direction: column;
		align-items: stretch;
		gap: 0.15rem;
	}

	.row.stack span {
		text-align: left;
	}

	.notes,
	.fail {
		margin: 0.7rem 0 0;
		padding: 0;
		color: #fca5a5;
		font-size: 0.82rem;
		line-height: 1.4;
	}

	.notes {
		list-style: none;
	}

	.caps {
		list-style: none;
		margin: 0.35rem 0 0;
		padding: 0;
		max-height: 14rem;
		overflow: auto;
	}

	.caps li {
		border-bottom: 1px solid var(--steel);
	}

	.caps label {
		display: flex;
		gap: 0.55rem;
		align-items: center;
		padding: 0.28rem 0.15rem;
		cursor: pointer;
	}

	.actions {
		display: flex;
		justify-content: flex-end;
		gap: 0.5rem;
		padding: 0.75rem 1.25rem 1rem;
	}
</style>
