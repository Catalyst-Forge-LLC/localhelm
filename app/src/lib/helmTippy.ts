import type { Instance, Placement, Props } from 'tippy.js';

const Z = 80;

export function helmTippyProps(input: {
	content: string;
	wide?: boolean;
	interactive?: boolean;
	placement?: Placement;
	delay?: number | [number, number];
}): Partial<Props> {
	const reduced = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
	return {
		content: input.content,
		placement: input.placement ?? 'top',
		delay: input.delay ?? 80,
		duration: reduced ? 0 : 125,
		animation: 'fade',
		arrow: true,
		theme: input.wide ? 'helm helm-wide' : 'helm',
		interactive: Boolean(input.interactive),
		appendTo: () => document.body,
		zIndex: Z,
		onCreate(instance) {
			instance.popper.querySelector('.tippy-box')?.classList.add('hud-frame');
		},
	};
}

/** Tippy on the node. Prefer `<Tooltip>` when the target can be `disabled`. */
export function tip(node: HTMLElement, content: string) {
	let instance: Instance | undefined;
	let cancelled = false;

	function mount(text: string): void {
		if (cancelled || instance || !text.trim()) return;
		void import('tippy.js').then(({ default: tippy }) => {
			if (cancelled || instance) return;
			instance = tippy(node, helmTippyProps({ content: text }));
		});
	}

	mount(content);

	return {
		update(next: string) {
			const text = next.trim();
			if (!instance) {
				mount(text);
				return;
			}
			if (!text) {
				instance.disable();
				return;
			}
			instance.setProps(helmTippyProps({ content: text }));
			instance.enable();
		},
		destroy() {
			cancelled = true;
			instance?.destroy();
		},
	};
}
