<script lang="ts">
	/**
	 * Self-contained sweep. Copy this file to reuse it.
	 * Recolor with --knight-color and --knight-glow on the component or a parent.
	 */
	let { size = '3px' }: { size?: string } = $props();
</script>

<span class="knight" style:--knight-size={size} aria-hidden="true">
	<span class="blob"></span>
</span>

<style>
	@property --knight-peak {
		syntax: '<percentage>';
		inherits: false;
		initial-value: 78%;
	}

	.knight {
		--knight-color: var(--cyan, #7ef4ff);
		--knight-glow: var(--cyan-glow, rgb(126 244 255 / 0.42));
		--knight-clear: rgb(from var(--knight-color) r g b / 0);
		position: relative;
		display: block;
		height: var(--knight-size);
		overflow: hidden;
		border-radius: 999px;
		background: color-mix(in srgb, var(--knight-color) 12%, transparent);
	}

	.blob {
		position: absolute;
		top: 0;
		bottom: 0;
		left: 0;
		width: 32%;
		border-radius: inherit;
		--knight-peak: 78%;
		background-image: linear-gradient(
			90deg,
			var(--knight-clear) 0%,
			var(--knight-clear) calc(var(--knight-peak) - 38%),
			var(--knight-color) var(--knight-peak),
			var(--knight-clear) calc(var(--knight-peak) + 16%)
		);
		filter: drop-shadow(0 0 6px var(--knight-glow));
		animation:
			knight-sweep 2.3s infinite,
			knight-peak 2.3s infinite;
	}

	@keyframes knight-sweep {
		0% {
			transform: translateX(-15%);
			animation-timing-function: ease-in-out;
		}
		50% {
			transform: translateX(230%);
			animation-timing-function: ease-in-out;
		}
		100% {
			transform: translateX(-15%);
		}
	}

	/* Each direction eases the peak to the nose and leaves the tail clear. Alternate would linger on one pass. */
	@keyframes knight-peak {
		0% {
			--knight-peak: 24%;
			animation-timing-function: cubic-bezier(0.2, 0.75, 0.25, 1);
		}
		50% {
			--knight-peak: 84%;
			animation-timing-function: cubic-bezier(0.2, 0.75, 0.25, 1);
		}
		100% {
			--knight-peak: 24%;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.blob {
			animation: none;
			left: 34%;
			--knight-peak: 62%;
			filter: none;
			opacity: 0.7;
		}
	}
</style>
