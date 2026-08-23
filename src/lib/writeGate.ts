import { bumpTriple, compareSemver, type BumpKind } from './semver.js';

/** Git fields the dashboard and plans both have. No Node imports — safe for the Svelte bundle. */
export type GateGit = {
	repo: boolean;
	dirty?: boolean;
	busy?: string;
	detached?: boolean;
	origin?: string;
	branch?: string;
	ahead: number | null;
	behind: number | null;
};

export type PublishGateRow = {
	missing: boolean;
	private: boolean;
	error?: string;
	unpublishedAhead: boolean;
	localVersion: string | null;
	npm: { name?: string; latest?: string; status: string; error?: string };
	git: GateGit;
};

/** Same skips as planPushOne. Dirty is not a skip — uncommitted files stay local. */
export function whyNotPush(git: GateGit): string | undefined {
	if (!git.repo) return 'no git';
	if (git.detached) return 'detached';
	if (git.busy) return git.busy;
	if (!git.origin) return 'no origin';
	if (!git.branch) return 'no branch';
	if (git.ahead == null || git.behind == null) return 'no upstream';
	if (git.behind > 0) return 'diverged';
	if (git.ahead === 0) return 'not ahead';
	return undefined;
}

/** Same skips as planPublishOne. Dirty still skips — publish would ship without leftover files. */
export function whyNotPublish(row: PublishGateRow, kind: BumpKind = 'patch'): string | undefined {
	if (row.missing) return 'folder missing';
	if (row.private) return 'private';
	if (row.error) return row.error;
	if (!row.npm.name) return 'no npm package name';
	if (!row.localVersion) return 'no local version';
	if (row.npm.status === 'error') return row.npm.error ?? 'npm lookup failed';
	if (row.npm.status === 'private') return 'private';
	if (!row.git.repo) return 'not a git repo';
	if (row.git.busy) return `mid-${row.git.busy}`;
	if (row.git.detached) return 'detached';
	if (row.git.dirty) return 'dirty';

	const neverPublished = row.npm.status === 'none';
	if (!neverPublished && row.npm.latest) {
		const cmp = compareSemver(row.localVersion, row.npm.latest);
		if (cmp !== null && cmp < 0) return 'local is behind npm';
	}

	const needsBump = !neverPublished && !row.unpublishedAhead;
	if (needsBump) {
		try {
			bumpTriple(row.localVersion, kind);
		} catch (err) {
			return err instanceof Error ? err.message : String(err);
		}
	}

	const needsPush = needsBump || (row.git.ahead ?? 0) > 0;
	if (needsPush) {
		if (!row.git.origin) return 'no origin';
		if (!row.git.branch) return 'no branch';
		if (row.git.ahead == null || row.git.behind == null) return 'no upstream';
		if (row.git.behind > 0) return 'diverged';
	}
	return undefined;
}

type CascadeConsumer = {
	id: string;
	missing: boolean;
	git: { dirty: boolean; busy?: string };
	pins: Array<{ targetId?: string; kind: string; onLatest?: boolean }>;
};

/** Registry pins the cascade plan would actually retarget (clean consumer, not link:/file:). */
export function writableCascadeCount(publisherId: string, projects: CascadeConsumer[]): number {
	let n = 0;
	for (const consumer of projects) {
		if (consumer.id === publisherId) continue;
		if (consumer.missing || consumer.git.dirty || consumer.git.busy) continue;
		for (const pin of consumer.pins) {
			if (pin.targetId === publisherId && pin.kind === 'registry' && pin.onLatest === false) n += 1;
		}
	}
	return n;
}
