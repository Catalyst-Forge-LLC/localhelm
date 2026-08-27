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
	/** Origin commits after the published version. 0 means Cut would bump with no new work. */
	commitsSinceNpm?: number | null;
};

/** Short line for fetch/push stderr. Keep the raw text in stderr / titles. */
export function plainGitError(raw: string): string {
	if (/permission denied \(publickey\)/i.test(raw)) return 'origin rejected the SSH key';
	if (/authentication failed|could not read username/i.test(raw)) return 'origin needs credentials';
	if (/timed out|operation timed out/i.test(raw)) return 'origin timed out';
	if (/could not resolve host/i.test(raw)) return 'origin host not found';
	if (/could not read from remote/i.test(raw)) return 'origin unreachable';
	const first = raw.split(/\r?\n/).find((line) => line.trim().length > 0) ?? raw;
	return first.slice(0, 90);
}

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
		if (row.commitsSinceNpm === 0) return 'nothing to cut';
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

/** Local already matches npm; publish would cut a new version. Same gate as the plan. */
export function canCutVersion(row: PublishGateRow): boolean {
	return !row.unpublishedAhead && !whyNotPublish(row);
}

export const FLEET_WRITE_ORDER = ['publish', 'push', 'pins', 'cut'] as const;
export type FleetWriteId = (typeof FLEET_WRITE_ORDER)[number];

/** Writes Today and Fleet both offer. Order is the gold-write priority. */
export function fleetWriteIds(row: PublishGateRow, writablePins = 0): FleetWriteId[] {
	const ids: FleetWriteId[] = [];
	if (row.unpublishedAhead && !whyNotPublish(row)) ids.push('publish');
	if ((row.git.ahead ?? 0) > 0 && !whyNotPush(row.git)) ids.push('push');
	if (writablePins > 0) ids.push('pins');
	if (canCutVersion(row)) ids.push('cut');
	return ids;
}

export function nextCutVersion(row: PublishGateRow, kind: BumpKind = 'patch'): string | undefined {
	if (!row.localVersion) return undefined;
	try {
		return bumpTriple(row.localVersion, kind);
	} catch {
		return undefined;
	}
}

/** Bare integers on writes are commit counts. Selected-row counts stay in parentheses. */
export function commitCountLabel(n: number | null | undefined): string {
	if (typeof n !== 'number' || !Number.isFinite(n) || n < 0) return '';
	return `${n} commit${n === 1 ? '' : 's'}`;
}

export function fleetWriteLabel(
	id: FleetWriteId,
	row: PublishGateRow,
	kind: BumpKind = 'patch',
	writablePins = 0,
): string {
	if (id === 'publish') return `Publish ${row.localVersion ?? ''}`.trim();
	if (id === 'push') {
		const commits = commitCountLabel(row.git.ahead);
		return commits ? `Push ${commits}` : 'Push';
	}
	if (id === 'pins') {
		if (writablePins === 1) return 'Write 1 pin';
		if (writablePins > 1) return `Write ${writablePins} pins`;
		return 'Write pins';
	}
	const next = nextCutVersion(row, kind);
	const commits = commitCountLabel(row.commitsSinceNpm);
	if (next && commits) return `Cut ${next} · ${commits}`;
	if (next) return `Cut ${next}`;
	if (commits) return `Cut version · ${commits}`;
	return 'Cut version';
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
