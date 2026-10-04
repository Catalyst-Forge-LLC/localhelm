export type FeatureReviewRow = {
	id: string;
	name: string;
	recognition: string;
	selected: boolean;
	summary: string;
};

export type FeatureReviewConfirm = {
	title: string;
	hint: string;
	items: string[];
	itemKeys: string[];
	itemLabels: string[];
	applyIds: string[];
	excludedIds: string[];
	confirmLabel: string;
	canApply: boolean;
};

/** Turn a FeatureFacts review plan into the confirm checklist. */
export function featureReviewConfirm(repoId: string, data: unknown): FeatureReviewConfirm {
	const features = reviewFeatures(data);
	if (!features) {
		throw new Error('Review did not return the capability list.');
	}
	if (!features.length) {
		return {
			title: `Nothing to review for ${repoId}`,
			hint: 'Scan this repo first. Review lists the capabilities Scan found.',
			items: ['Scan this repo first.'],
			itemKeys: [],
			itemLabels: [],
			applyIds: [],
			excludedIds: [],
			confirmLabel: 'Update label',
			canApply: false,
		};
	}
	return {
		title: `Choose capabilities for ${repoId}?`,
		hint: 'Tick up to 12. Confirm writes FEATURE_FACTS.md. Unticked rows stay in the register.',
		items: features.map((row) => `${row.name}\n${row.summary}`),
		itemKeys: features.map((row) => row.id),
		itemLabels: features.map((row) => row.name),
		applyIds: features.map((row) => row.id),
		excludedIds: features.filter((row) => !row.selected).map((row) => row.id),
		confirmLabel: 'Update label',
		canApply: true,
	};
}

function reviewFeatures(data: unknown): FeatureReviewRow[] | null {
	if (!data || typeof data !== 'object') return null;
	const features = (data as { features?: unknown }).features;
	if (!Array.isArray(features)) return null;
	const rows: FeatureReviewRow[] = [];
	for (const item of features) {
		if (!item || typeof item !== 'object') return null;
		const row = item as Record<string, unknown>;
		if (typeof row.id !== 'string' || typeof row.name !== 'string') return null;
		rows.push({
			id: row.id,
			name: row.name,
			recognition: typeof row.recognition === 'string' ? row.recognition : 'candidate',
			selected: row.selected === true,
			summary: typeof row.summary === 'string' ? row.summary : '',
		});
	}
	return rows;
}
