<script lang="ts">
	import { FEATURE_LABEL_LIMIT, type FeatureLabelModel } from './featureLabel';

	type Props = {
		open: boolean;
		model: FeatureLabelModel | null;
		ticked: string[];
		busy?: boolean;
		busyLabel?: string;
		error?: string;
		onscan?: () => void;
		onupdate?: () => void;
	};

	let {
		open = $bindable(),
		model,
		ticked = $bindable([]),
		busy = false,
		busyLabel = '',
		error = '',
		onscan,
		onupdate,
	}: Props = $props();

	let dialogEl = $state<HTMLDialogElement | null>(null);

	const overLimit = $derived(ticked.length > FEATURE_LABEL_LIMIT);
	const canUpdate = $derived(Boolean(model && model.features.length > 0 && !overLimit && !busy));

	$effect(() => {
		if (!dialogEl) return;
		if (open && !dialogEl.open) dialogEl.showModal();
		else if (!open && dialogEl.open) dialogEl.close();
	});

	function toggle(id: string, on: boolean): void {
		if (busy) return;
		ticked = on ? [...new Set([...ticked, id])] : ticked.filter((item) => item !== id);
	}

	function detail(row: { lifecycle: string; availability: string; maturity: string; evidence: string }): string {
		const bits = [row.lifecycle, row.availability && `availability ${row.availability}`, row.maturity && `maturity ${row.maturity}`, row.evidence && `evidence ${row.evidence}`].filter(Boolean);
		return bits.join(' · ');
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
			<h2 id="feature-label-title">Label for {model?.repoId ?? 'repo'}</h2>
			<p class="hint">Tick up to 12. Update label writes the file. Close leaves it unchanged. Scan refreshes the list and does not write the label.</p>
			{#if busy}
				<p class="working">{busyLabel || 'Working…'}</p>
			{/if}
			{#if model?.card}
				<section class="paper" aria-label="FeatureFacts label">
					<h3>{model.card.name || model.repoId}</h3>
					<p class="serving">
						{[model.card.type, model.card.status].filter(Boolean).join(' · ') || 'FeatureFacts label'}
					</p>
					<p class="question">What can this product do?</p>
					{#each model.card.rows as row (row.name)}
						<div class="fact">
							<strong>{row.name}</strong>
							<span>{detail(row)}</span>
						</div>
					{/each}
				</section>
			{:else}
				<section class="paper empty" aria-label="FeatureFacts label">
					<h3>No label yet</h3>
					<p>Tick up to 12 capabilities, then Update label.</p>
				</section>
			{/if}
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
			{#if model && model.features.length}
				<p class="count">{ticked.length} of {model.features.length} ticked</p>
				<ul class="caps">
					{#each model.features as row (row.id)}
						<li>
							<label>
								<input
									type="checkbox"
									checked={ticked.includes(row.id)}
									disabled={busy}
									onchange={(event) => toggle(row.id, event.currentTarget.checked)}
								/>
								<span>
									<strong>{row.name}</strong>
									{#if row.summary}<span class="sum">{row.summary}</span>{/if}
								</span>
							</label>
						</li>
					{/each}
				</ul>
			{:else if model}
				<p class="hint">Scan this repo to find capabilities.</p>
			{/if}
		</div>
		<div class="actions">
			<button type="button" class="btn" disabled={busy} onclick={() => (open = false)}>Close</button>
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
		width: min(40rem, calc(100vw - 2rem));
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
		flex: 1;
		overflow: auto;
		padding: 1.15rem 1.25rem 0.6rem;
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

	.paper {
		margin-top: 0.85rem;
		padding: 0.85rem 0.95rem 0.35rem;
		background: #f8fafc;
		color: #101418;
		border-top: 4px solid #101418;
	}

	.paper h3 {
		margin: 0;
		font-size: 1.15rem;
		letter-spacing: -0.03em;
		text-transform: uppercase;
	}

	.serving {
		margin: 0.35rem 0 0;
		padding-bottom: 0.45rem;
		border-bottom: 6px solid #101418;
		font-size: 0.75rem;
	}

	.question {
		margin: 0.55rem 0 0.15rem;
		font-size: 0.82rem;
	}

	.fact {
		display: flex;
		justify-content: space-between;
		gap: 1rem;
		padding: 0.32rem 0;
		border-bottom: 1px solid #101418;
		font-size: 0.78rem;
	}

	.fact span {
		text-align: right;
		color: #44505c;
	}

	.paper.empty p {
		margin: 0.45rem 0 0.7rem;
		font-size: 0.82rem;
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
	}

	.caps li {
		border-bottom: 1px solid var(--steel);
	}

	.caps label {
		display: flex;
		gap: 0.55rem;
		align-items: flex-start;
		padding: 0.4rem 0;
		cursor: pointer;
	}

	.caps strong {
		display: block;
		font-weight: 600;
	}

	.sum {
		display: block;
		color: var(--dim);
		font-size: 0.75rem;
	}

	.actions {
		display: flex;
		justify-content: flex-end;
		gap: 0.5rem;
		padding: 0.75rem 1.25rem 1rem;
	}
</style>
