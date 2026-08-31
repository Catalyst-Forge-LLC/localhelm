<script lang="ts">
	import VisitorFace from '$lib/VisitorFace.svelte';

	let { data } = $props();
</script>

<svelte:head>
	<title>LocalHelm Deck</title>
</svelte:head>

<VisitorFace initial={data.visitor} pageHost={data.pageHost} />
