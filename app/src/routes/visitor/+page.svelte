<script lang="ts">
	import VisitorFace from '$lib/VisitorFace.svelte';

	let { data } = $props();
</script>

<svelte:head>
	<title>LocalHelm visitor</title>
</svelte:head>

<VisitorFace initial={data.visitor} pageHost={data.pageHost} />
