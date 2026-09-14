/** Publish apply result copy. No Node imports — safe for the Svelte bundle. */

export function isGithubPublishReason(reason: string | undefined): boolean {
	return Boolean(reason?.startsWith('open GitHub Publish'));
}

export function isPublishedReason(reason: string | undefined): boolean {
	return Boolean(reason?.startsWith('published ') || isGithubPublishReason(reason));
}

/** A publish apply row that did not reach npm or open a GitHub Publish link. */
export function publishApplyHadFailure(
	rows: ReadonlyArray<{ action: string; reason?: string }>,
): boolean {
	return rows.some((row) => row.action === 'publish' && !isPublishedReason(row.reason));
}

/**
 * After a laptop-only npm publish, the confirm may jump to Install globally.
 * Do not skip when any row still needs a GitHub Publish click (OIDC / mixed batch).
 */
export function canSkipPublishResultsForGlobalInstall(
	rows: ReadonlyArray<{ reason?: string }>,
): boolean {
	if (!rows.length) return false;
	if (rows.some((row) => !isPublishedReason(row.reason))) return false;
	if (rows.some((row) => isGithubPublishReason(row.reason))) return false;
	return true;
}

export function publishApplyTitle(rows: ReadonlyArray<{ id: string; reason?: string }>): string {
	const github = rows.filter((row) => isGithubPublishReason(row.reason)).length;
	const published = rows.filter((row) => row.reason?.startsWith('published ')).length;
	const failed = rows.filter((row) => !isPublishedReason(row.reason));
	const ok = [
		published ? `${published} published` : '',
		github ? `${github} opened GitHub` : '',
	]
		.filter(Boolean)
		.join(', ') || '0 published';
	if (failed.length === 0) return `publish --apply — ${ok}`;
	return `publish --apply — ${ok}, ${failed.length} failed: ${failed.map((row) => row.id).join(', ')}`;
}

export function publishResultLine(row: { id: string; reason?: string }): string {
	return `${row.id}  ${row.reason ?? 'no result'}`;
}

export function orderPublishResults<T extends { reason?: string }>(rows: readonly T[]): T[] {
	const rank = (reason?: string): number => {
		if (!isPublishedReason(reason)) return 0;
		if (isGithubPublishReason(reason)) return 1;
		return 2;
	};
	return [...rows].sort((a, b) => rank(a.reason) - rank(b.reason));
}

export function publishResultTitle(rows: ReadonlyArray<{ id?: string; reason?: string }>): string {
	const failed = rows.filter((row) => !isPublishedReason(row.reason));
	const github = rows.filter((row) => isGithubPublishReason(row.reason)).length;
	const published = rows.filter((row) => row.reason?.startsWith('published ')).length;
	if (!rows.length) return 'Nothing published';
	if (failed.length === rows.length) {
		return rows.length === 1 ? 'Nothing reached npm' : `Nothing reached npm (${rows.length} failed)`;
	}
	if (failed.length) return `${failed.length} of ${rows.length} failed`;
	if (github && !published) {
		return rows.length === 1 ? 'Open GitHub to publish' : `Open GitHub for ${github} packages`;
	}
	if (rows.length === 1) {
		return `Published ${rows[0]?.reason?.replace(/^published /, '') ?? rows[0]?.id}`;
	}
	if (github) return `Published ${published}, opened GitHub for ${github}`;
	return `Published ${published} packages`;
}

export function publishResultHint(rows: ReadonlyArray<{ reason?: string }>): string {
	const failed = rows.some((row) => !isPublishedReason(row.reason));
	const github = rows.some((row) => isGithubPublishReason(row.reason));
	const published = rows.some((row) => row.reason?.startsWith('published '));
	if (failed) return 'Failed names are first. Click one to see why. Activity keeps the full npm log.';
	if (github && !published) {
		return 'Laptop npm publish is blocked (OIDC provenance). Click the GitHub Publish link and run the workflow.';
	}
	if (github) return 'Packages that reached npm are listed. Click any GitHub Publish link to run that workflow.';
	return 'All listed packages reached npm.';
}

export function publishResultPhase(reason: string | undefined): 'done' | 'fail' {
	return isPublishedReason(reason) ? 'done' : 'fail';
}
