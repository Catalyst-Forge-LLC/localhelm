import { featurefactsCheckLines, reviewFeatureRows, type FeatureReviewRow } from './featureReview.js';

export const FEATURE_LABEL_LIMIT = 12;

export type FeatureLabelCardRow = {
	name: string;
	lifecycle: string;
	availability: string;
	maturity: string;
	evidence: string;
};

export type FeatureLabelCard = {
	name: string;
	type: string;
	status: string;
	rows: FeatureLabelCardRow[];
};

export type FeatureLabelModel = {
	repoId: string;
	features: FeatureReviewRow[];
	card: FeatureLabelCard | null;
	notes: string[];
};

function text(value: unknown): string {
	return typeof value === 'string' ? value.trim() : '';
}

function parseCard(data: unknown): FeatureLabelCard | null {
	if (!data || typeof data !== 'object') return null;
	const card = (data as { card?: unknown }).card;
	if (!card || typeof card !== 'object') return null;
	const body = card as Record<string, unknown>;
	if (!Array.isArray(body.rows)) return null;
	const rows: FeatureLabelCardRow[] = [];
	for (const item of body.rows) {
		if (!item || typeof item !== 'object') continue;
		const row = item as Record<string, unknown>;
		const name = text(row.name);
		if (!name) continue;
		rows.push({
			name,
			lifecycle: text(row.lifecycle),
			availability: text(row.availability),
			maturity: text(row.maturity),
			evidence: text(row.evidence),
		});
	}
	if (!rows.length) return null;
	return {
		name: text(body.name),
		type: text(body.type),
		status: text(body.status),
		rows,
	};
}

/** Problems only. A missing label is already the empty card. */
export function labelProblemNotes(detail: string): string[] {
	return featurefactsCheckLines(detail).filter((line) => {
		if (line === 'The register and the label match this repo.') return false;
		if (line.startsWith('No label yet.')) return false;
		if (line.startsWith('The label file is empty.')) return false;
		return true;
	});
}

export function featureLabelModel(repoId: string, data: unknown): FeatureLabelModel {
	const features = reviewFeatureRows(data);
	if (!features) throw new Error('Label did not return the capability list.');
	const check = data && typeof data === 'object' ? text((data as { check?: unknown }).check) : '';
	return {
		repoId,
		features,
		card: parseCard(data),
		notes: check ? labelProblemNotes(check) : [],
	};
}

/** Saved ticks, or the ids still present after a scan. */
export function labelTickSeed(features: FeatureReviewRow[], keep?: string[]): string[] {
	const known = new Set(features.map((row) => row.id));
	if (keep) return keep.filter((id) => known.has(id));
	return features.filter((row) => row.selected).map((row) => row.id);
}
