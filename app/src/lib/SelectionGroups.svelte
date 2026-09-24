<script lang="ts">
	import { onMount } from 'svelte';
	import { matchingGroupIds, type SelectionGroup } from '$lib/groupSelect';
	import Icon from './Icon.svelte';

	let {
		groups,
		checkedIds,
		presentIds,
		busy = false,
		onapply,
		onsave,
		ondelete,
	}: {
		groups: SelectionGroup[];
		checkedIds: string[];
		presentIds: string[];
		busy?: boolean;
		onapply: (ids: string[]) => void;
		onsave: (name: string) => Promise<string>;
		ondelete: (name: string) => Promise<void>;
	} = $props();

	let picked = $state('');
	let open = $state(false);
	let naming = $state(false);
	let draft = $state('');
	let note = $state('');
	let rootEl = $state<HTMLDivElement | null>(null);

	$effect(() => {
		if (picked && !groups.some((group) => group.name === picked)) picked = '';
	});

	function close(): void {
		open = false;
		naming = false;
	}

	function choose(name: string): void {
		note = '';
		const group = groups.find((item) => item.name === name);
		if (!group) return;
		picked = name;
		const matched = matchingGroupIds(group.ids, presentIds);
		onapply(group.ids);
		note = matched.length ? '' : `${group.name} has no rows on this list.`;
		close();
	}

	function startName(): void {
		note = '';
		draft = picked;
		naming = true;
		open = true;
	}

	async function save(): Promise<void> {
		note = '';
		try {
			picked = await onsave(draft);
			draft = '';
			close();
		} catch (err) {
			note = err instanceof Error ? err.message : String(err);
		}
	}

	async function remove(): Promise<void> {
		if (!picked) return;
		note = '';
		try {
			await ondelete(picked);
			picked = '';
			close();
		} catch (err) {
			note = err instanceof Error ? err.message : String(err);
		}
	}

	onMount(() => {
		function onPointer(event: PointerEvent): void {
			if (!open || !rootEl) return;
			if (event.target instanceof Node && rootEl.contains(event.target)) return;
			close();
		}
		function onKey(event: KeyboardEvent): void {
			if (event.key === 'Escape') close();
		}
		document.addEventListener('pointerdown', onPointer);
		document.addEventListener('keydown', onKey);
		return () => {
			document.removeEventListener('pointerdown', onPointer);
			document.removeEventListener('keydown', onKey);
		};
	});
</script>

<div class="groups" bind:this={rootEl}>
		<button
		type="button"
		class="btn"
		aria-haspopup="true"
		aria-expanded={open}
		disabled={busy}
		onclick={() => (open = !open)}
	>
		<Icon icon="lucide:layers" />
		{picked || 'Groups'}
	</button>
	{#if note}<span class="miss">{note}</span>{/if}
	{#if open}
		<div class="menu" aria-label="Saved groups">
			{#if naming}
				<input
					class="name"
					bind:value={draft}
					placeholder="Name"
					maxlength="48"
					aria-label="Group name"
					disabled={busy}
					onkeydown={(event) => {
						if (event.key === 'Enter') {
							event.preventDefault();
							void save();
						}
					}}
				/>
				<button type="button" class="btn" disabled={busy || !draft.trim()} onclick={() => void save()}>Save</button>
				<button type="button" class="btn" disabled={busy} onclick={() => (naming = false)}>Cancel</button>
			{:else}
				{#if groups.length === 0}
					<p class="empty">No groups yet. Check rows, then save them.</p>
				{/if}
				{#each groups as group (group.name)}
					<button type="button" class="btn" class:on={group.name === picked} onclick={() => choose(group.name)}>
						{group.name}
					</button>
				{/each}
				<button type="button" class="btn" disabled={busy || checkedIds.length === 0} onclick={startName}>
					Save checked as…
				</button>
				{#if picked}
					<button type="button" class="btn" disabled={busy} onclick={() => void remove()}>Delete {picked}</button>
				{/if}
			{/if}
		</div>
	{/if}
</div>

<style>
	.groups {
		position: relative;
		display: inline-flex;
		flex-wrap: wrap;
		gap: 0.35rem;
		align-items: center;
	}

	.menu {
		position: absolute;
		top: calc(100% + 0.3rem);
		left: 0;
		z-index: 40;
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
		min-width: 12.5rem;
		padding: 0.35rem;
		border: 1px solid var(--steel);
		background: var(--hull, #0c1218);
		border-radius: var(--plate-radius, 6px);
		box-shadow: 0 8px 24px rgb(0 0 0 / 0.35);
	}

	.menu :global(.btn) {
		width: 100%;
		justify-content: flex-start;
	}

	.menu :global(.btn.on) {
		border-color: var(--cyan, #7ef4ff);
		color: var(--cyan, #7ef4ff);
	}

	.name {
		width: 100%;
		border: 1px solid var(--steel);
		background: var(--well);
		color: #ececef;
		border-radius: var(--plate-radius-sm, 4px);
		font-size: 0.8rem;
		padding: 0.28rem 0.5rem;
	}

	.empty {
		margin: 0;
		padding: 0.15rem 0.35rem 0.35rem;
		color: var(--dim);
		font-size: 0.75rem;
		line-height: 1.35;
	}

	.miss {
		color: var(--dim);
		font-size: 0.75rem;
	}
</style>
