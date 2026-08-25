import { whyNotPublish, whyNotPush } from './writeGate.js';

export type BriefProject = {
	id: string;
	missing: boolean;
	unpublishedAhead: boolean;
	localVersion: string | null;
	git: {
		dirty: boolean;
		ahead: number | null;
		repo: boolean;
		detached?: boolean;
		origin?: string;
		busy?: string;
		behind: number | null;
	};
	private: boolean;
	error?: string;
	npm: { name?: string; latest?: string; status: string; error?: string };
};

export type BriefLease = {
	id: string;
	listening: boolean;
	recipe: string;
	parked?: boolean;
};

export function formatBrief(input: {
	projects: BriefProject[];
	leases?: BriefLease[];
	activityTitles?: string[];
}): string {
	const lines: string[] = ['# LocalHelm brief', ''];
	const dirty = input.projects.filter((row) => row.git.dirty && !row.missing);
	const unpublished = input.projects.filter((row) => row.unpublishedAhead && !whyNotPublish(row));
	const pushable = input.projects.filter((row) => !whyNotPush(row.git));
	const missing = input.projects.filter((row) => row.missing);

	lines.push('## Needs a write');
	if (!unpublished.length && !pushable.length && !dirty.length && !missing.length) {
		lines.push('- none');
	} else {
		for (const row of unpublished) lines.push(`- publish ${row.id}${row.localVersion ? ` ${row.localVersion}` : ''}`);
		for (const row of pushable) {
			if (unpublished.some((other) => other.id === row.id)) continue;
			lines.push(`- push ${row.id}${row.git.ahead ? ` (${row.git.ahead})` : ''}`);
		}
		for (const row of dirty) {
			if (unpublished.some((other) => other.id === row.id) || pushable.some((other) => other.id === row.id)) continue;
			lines.push(`- dirty ${row.id}`);
		}
		for (const row of missing) lines.push(`- missing ${row.id}`);
	}

	const leases = (input.leases ?? []).filter((row) => row.parked !== true);
	const downRecipe = leases.filter((row) => !row.listening && row.recipe && row.recipe !== '—');
	const downBare = leases.filter((row) => !row.listening && (!row.recipe || row.recipe === '—'));
	lines.push('', '## Ports');
	if (!leases.length) {
		lines.push('- no Ports plugin');
	} else {
		lines.push(`- listening ${leases.filter((row) => row.listening).length} / ${leases.length}`);
		for (const row of downRecipe) lines.push(`- down with recipe ${row.id} (${row.recipe})`);
		for (const row of downBare.slice(0, 8)) lines.push(`- down no recipe ${row.id}`);
		if (downBare.length > 8) lines.push(`- … ${downBare.length - 8} more without a recipe`);
	}

	const titles = (input.activityTitles ?? []).filter(Boolean).slice(0, 5);
	lines.push('', '## Last activity');
	if (!titles.length) lines.push('- none');
	else for (const title of titles) lines.push(`- ${title}`);

	lines.push('');
	return lines.join('\n');
}
