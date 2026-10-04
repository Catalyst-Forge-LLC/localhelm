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
	const features = reviewFeatureRows(data);
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

export function reviewFeatureRows(data: unknown): FeatureReviewRow[] | null {
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

/** Plain sentences for a FeatureFacts check. The command prints schema paths and fingerprint names. */
export function featurefactsCheckLines(detail: string): string[] {
	const raw = detail
		.split('\n')
		.map((part) => part.trim())
		.filter(Boolean);
	if (!raw.length) return ['Check failed.'];
	const lines: string[] = [];
	const push = (line: string) => {
		if (!lines.includes(line)) lines.push(line);
	};
	for (const part of raw) {
		if (/must be equal to constant|must match "then" schema|must match a schema/.test(part)) {
			push('Some confirmed capabilities are still marked as scan clusters. Update the label again.');
			continue;
		}
		if (part === 'Source fingerprint is stale.') {
			push('The repo changed after the last Scan. Scan again to refresh.');
			continue;
		}
		if (part === 'Config fingerprint is stale.') {
			push('FeatureFacts config changed after the last Scan. Scan again to refresh.');
			continue;
		}
		if (part === 'Adapter fingerprint is stale.') {
			push('The scanner changed since the last Scan. Scan again to refresh.');
			continue;
		}
		if (part === 'Rules fingerprint is stale.') {
			push('The rules changed since the last Scan. Scan again to refresh.');
			continue;
		}
		if (part.startsWith('FEATURE_FACTS.md is missing')) {
			push('No label yet. Tick capabilities, then Update label.');
			continue;
		}
		if (part.includes('has no selected capabilities')) {
			push('The label file is empty. Tick capabilities and update the label.');
			continue;
		}
		if (part === 'Check passed.' || part === 'Projection check passed.') {
			push('The register and the label match this repo.');
			continue;
		}
		push(part);
	}
	return lines;
}
