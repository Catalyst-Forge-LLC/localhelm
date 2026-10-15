<script lang="ts">
	import OverflowMenu from './OverflowMenu.svelte';
	import type { BumpKind } from './dashboardTypes';
	type Action = { id: string; label: string; title: string; run: () => void; disabled?: boolean };
	let { id, actions, busy, kind, nextVersion, canBump, hint = '', onkind, onbump }: {
		id: string; actions: Action[]; busy: boolean; kind: BumpKind; nextVersion?: string;
		canBump: boolean; hint?: string; onkind: (kind: BumpKind) => void; onbump: () => void;
	} = $props();
	const primary = $derived(actions.find((action) => !action.disabled));
	const secondary = $derived(actions.filter((action) => action !== primary));
</script>
<div class="row-actions">
	{#if primary}<button type="button" class="btn btn-sm btn-write" title={primary.title} disabled={busy} onclick={primary.run}>{primary.label}</button>{/if}
	<OverflowMenu ariaLabel={`More actions for ${id}`}>
		{#each secondary as action (action.id)}
			<button type="button" class="btn btn-sm" title={action.title} disabled={busy || action.disabled} onclick={action.run}>{action.label}</button>
			{#if action.disabled}<p class="dim small">{action.title}</p>{/if}
		{/each}
		<label class="dim small">Version bump
			<select aria-label={`bump kind for ${id}`} value={kind} disabled={busy || !canBump} onchange={(event) => onkind(event.currentTarget.value as BumpKind)}>
				<option value="patch">patch</option><option value="minor">minor</option><option value="major">major</option>
			</select>
		</label>
		<button type="button" class="btn btn-sm" disabled={busy || !canBump} onclick={onbump}>{nextVersion ? `Plan bump to ${nextVersion}` : 'Plan version bump'}</button>
		<p class="dim small">Bump writes and commits the version source. Publish includes this step when needed.</p>
	</OverflowMenu>
</div>
{#if hint}<p class="dim small recovery-hint">{hint}</p>{/if}
<style>.row-actions { display: flex; flex-wrap: wrap; align-items: center; gap: .35rem; } label { display: flex; align-items: center; gap: .5rem; } p { max-width: 24rem; white-space: normal; margin: .3rem 0; } .recovery-hint { overflow-wrap: anywhere; }</style>
