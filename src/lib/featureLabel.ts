import { featurefactsCheckLines, reviewFeatureRows, type FeatureReviewRow } from './featureReview.js';

export const FEATURE_LABEL_LIMIT = 12;

export type FeatureLabelCardRow = {
	name: string;
	lifecycle: string;
	availability: string;
	maturity: string;
	documentation: string;
	tests: string;
	evidence: string;
};

export type LabelPaperPair = { label: string; value: string };

function knownValue(value: string | undefined): string {
	const text = (value ?? '').trim();
	return !text || text.toLowerCase() === 'unknown' ? '' : text;
}

/** Same rows FilePress draws for a FeatureFacts label. Unknown fields stay off the card. */
export function labelPaperRows(
	rows: Array<{
		name: string;
		lifecycle?: string;
		availability?: string;
		maturity?: string;
		documentation?: string;
		tests?: string;
		evidence?: string;
	}>,
): LabelPaperPair[] {
	const names = rows.map((row) => row.name.trim()).filter(Boolean);
	const pairs: LabelPaperPair[] = [];
	if (names.length) pairs.push({ label: 'Selected', value: names.join(' · ') });
	const shared = (pick: (row: (typeof rows)[number]) => string | undefined): string => {
		const present = rows.map((row) => knownValue(pick(row)));
		if (!present.length || present.some((value) => !value)) return '';
		const unique = [...new Set(present)];
		return unique.length === 1 ? unique[0] : 'mixed';
	};
	const fields: Array<[string, (row: (typeof rows)[number]) => string | undefined]> = [
		['Lifecycle', (row) => row.lifecycle],
		['Availability', (row) => row.availability],
		['Maturity', (row) => row.maturity],
		['Documentation', (row) => row.documentation],
		['Tests', (row) => row.tests],
		['Evidence', (row) => row.evidence],
	];
	for (const [label, pick] of fields) {
		const value = shared(pick);
		if (value) pairs.push({ label, value });
	}
	return pairs;
}

export function labelPaperMeta(card: { type?: string; status?: string } | null): LabelPaperPair[] {
	const pairs: LabelPaperPair[] = [];
	const type = knownValue(card?.type);
	const status = knownValue(card?.status);
	if (type) pairs.push({ label: 'Type', value: type });
	if (status) pairs.push({ label: 'Status', value: status });
	return pairs;
}

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
			documentation: text(row.documentation),
			tests: text(row.tests),
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
