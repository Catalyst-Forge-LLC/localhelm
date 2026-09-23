<script lang="ts">
	import { matchingGroupIds, type SelectionGroup } from '$lib/groupSelect';
	import Tooltip from './Tooltip.svelte';

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
	let naming = $state(false);
	let draft = $state('');
	let note = $state('');

	$effect(() => {
		if (picked && !groups.some((group) => group.name === picked)) picked = '';
	});

	function choose(name: string): void {
		note = '';
		const group = groups.find((item) => item.name === name);
		if (!group) return;
		const matched = matchingGroupIds(group.ids, presentIds);
		onapply(group.ids);
		note = matched.length ? '' : `${group.name} has no rows on this list.`;
	}

	function startName(): void {
		note = '';
		draft = picked;
		naming = true;
	}

	async function save(): Promise<void> {
		note = '';
		try {
			picked = await onsave(draft);
			naming = false;
			draft = '';
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
		} catch (err) {
			note = err instanceof Error ? err.message : String(err);
		}
	}
</script>

<div class="sel-groups">
	<Tooltip title="Check the saved rows on this list. Ids with no row here are skipped.">
		<select
			aria-label="Saved groups"
			value={picked}
			disabled={busy || groups.length === 0}
			onchange={(event) => {
				const name = event.currentTarget.value;
				picked = name;
				if (name) choose(name);
			}}
		>
			<option value="">{groups.length ? 'Group…' : 'No groups yet'}</option>
			{#each groups as group (group.name)}
				<option value={group.name}>{group.name}</option>
			{/each}
		</select>
	</Tooltip>
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
				} else if (event.key === 'Escape') {
					naming = false;
					note = '';
				}
			}}
		/>
		<button type="button" class="btn" disabled={busy || !draft.trim()} onclick={() => void save()}>Save</button>
		<button
			type="button"
			class="btn"
			disabled={busy}
			onclick={() => {
				naming = false;
				note = '';
			}}>Cancel</button
		>
	{:else}
		<Tooltip title="Stores the checked rows under this name. Saving the same name replaces that list. It works on every tab.">
			<button type="button" class="btn" disabled={busy || checkedIds.length === 0} onclick={startName}>Save group</button>
		</Tooltip>
		{#if picked}
			<Tooltip title={`Delete ${picked}. Rows stay checked.`}>
				<button type="button" class="btn" disabled={busy} onclick={() => void remove()}>Delete</button>
			</Tooltip>
		{/if}
	{/if}
	{#if note}<span class="miss">{note}</span>{/if}
</div>

<style>
	.sel-groups {
		display: inline-flex;
		flex-wrap: wrap;
		gap: 0.35rem;
		align-items: center;
	}

	.name {
		width: 8.5rem;
		border: 1px solid var(--steel);
		background: var(--well);
		color: #ececef;
		border-radius: var(--plate-radius-sm, 4px);
		font-size: 0.8rem;
		padding: 0.28rem 0.5rem;
	}

	.miss {
		color: var(--dim);
		font-size: 0.75rem;
	}
</style>
