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
		initial-value: 84%;
	}

	@property --knight-before {
		syntax: '<percentage>';
		inherits: false;
		initial-value: 38%;
	}

	@property --knight-after {
		syntax: '<percentage>';
		inherits: false;
		initial-value: 16%;
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
		--knight-peak: 84%;
		--knight-before: 38%;
		--knight-after: 16%;
		/* Long fade sits behind the peak. Short fade sits in front. Those swap when the sweep turns. */
		background-image: linear-gradient(
			90deg,
			var(--knight-clear) 0%,
			var(--knight-clear) calc(var(--knight-peak) - var(--knight-before)),
			var(--knight-color) var(--knight-peak),
			var(--knight-clear) calc(var(--knight-peak) + var(--knight-after))
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

	/* Peak eases to the nose. The long fade stays behind it, and flips at each turn. */
	@keyframes knight-peak {
		0% {
			--knight-peak: 16%;
			--knight-before: 38%;
			--knight-after: 16%;
			animation-timing-function: cubic-bezier(0.2, 0.75, 0.25, 1);
		}
		50% {
			--knight-peak: 84%;
			--knight-before: 38%;
			--knight-after: 16%;
			animation-timing-function: step-end;
		}
		50.01% {
			--knight-peak: 84%;
			--knight-before: 16%;
			--knight-after: 38%;
			animation-timing-function: cubic-bezier(0.2, 0.75, 0.25, 1);
		}
		100% {
			--knight-peak: 16%;
			--knight-before: 16%;
			--knight-after: 38%;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.blob {
			animation: none;
			left: 34%;
			--knight-peak: 62%;
			--knight-before: 38%;
			--knight-after: 16%;
			filter: none;
			opacity: 0.7;
		}
	}
</style>
