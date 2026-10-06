type MenuPlacement = { anchor: HTMLElement | null; align?: 'start' | 'end' };

/** Keep toolbar dropdowns inside the viewport, including in scrollable panels. */
export function placeMenu(node: HTMLElement, initial: MenuPlacement) {
	let options = initial;
	const inset = 8;
	const gap = 5;

	function position() {
		if (!options.anchor) return;
		const anchor = options.anchor.getBoundingClientRect();
		const width = document.documentElement.clientWidth;
		const height = document.documentElement.clientHeight;
		node.style.position = 'fixed';
		node.style.right = 'auto';
		node.style.maxWidth = `${Math.max(0, width - inset * 2)}px`;
		node.style.minWidth = `${Math.min(200, Math.max(0, width - inset * 2))}px`;
		node.style.boxSizing = 'border-box';
		const below = Math.max(0, height - anchor.bottom - gap - inset);
		const above = Math.max(0, anchor.top - gap - inset);
		const opensAbove = node.scrollHeight > below && above > below;
		node.style.maxHeight = `${opensAbove ? above : below}px`;
		node.style.overflowY = 'auto';
		const menu = node.getBoundingClientRect();
		const preferredLeft = options.align === 'end' ? anchor.right - menu.width : anchor.left;
		node.style.left = `${Math.max(inset, Math.min(preferredLeft, width - menu.width - inset))}px`;
		node.style.top = `${Math.max(inset, opensAbove ? anchor.top - gap - menu.height : anchor.bottom + gap)}px`;
	}

	const observer = new ResizeObserver(position);
	observer.observe(node);
	if (options.anchor) observer.observe(options.anchor);
	window.addEventListener('resize', position);
	document.addEventListener('scroll', position, true);
	position();
	return {
		update(next: MenuPlacement) {
			if (options.anchor) observer.unobserve(options.anchor);
			options = next;
			if (options.anchor) observer.observe(options.anchor);
			position();
		},
		destroy() {
			observer.disconnect();
			window.removeEventListener('resize', position);
			document.removeEventListener('scroll', position, true);
		},
	};
}
