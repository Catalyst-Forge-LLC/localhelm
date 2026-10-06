<script lang="ts">
	import type { Snippet } from 'svelte';
	import OverflowMenu from './OverflowMenu.svelte';
	let { children }: { children: Snippet } = $props();
</script>

<div class="inline-actions">{@render children()}</div>
<div class="compact-actions">
	<OverflowMenu>{@render children()}</OverflowMenu>
</div>

<style>
	.inline-actions {
		display: contents;
	}
	.compact-actions {
		display: none;
	}
	@media (max-width: 55rem) {
		.inline-actions {
			display: none;
		}
		.compact-actions {
			display: contents;
		}
	}
</style>
