<script lang="ts">
	import './layout.css';
	let { children } = $props();
</script>

<svelte:head>
	<link rel="icon" href="/logo.png" type="image/png" />
	<meta name="robots" content="noindex" />
</svelte:head>
{@render children()}
