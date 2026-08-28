export function landConfirmItems(
	plans: readonly { siteId: string; steps: readonly { label: string }[] }[],
): { items: string[]; keys: string[] } {
	const multi = plans.length > 1;
	const items: string[] = [];
	const keys: string[] = [];
	for (const plan of plans) {
		if (!plan.steps.length) {
			items.push(multi ? `${plan.siteId}  already current` : 'Already current.');
			keys.push(plan.siteId);
			continue;
		}
		for (const step of plan.steps) {
			items.push(multi ? `${plan.siteId}  ${step.label}` : step.label);
			keys.push(plan.siteId);
		}
	}
	return { items, keys };
}
