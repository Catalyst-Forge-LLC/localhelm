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
	/** Origin commits after the published version. 0 means Publish would bump with no new work. */
	commitsSinceNpm?: number | null;
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
		if (row.commitsSinceNpm === 0) return 'nothing to publish';
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

/** Same gate as the publish plan: unpublished-ahead or a version bump with new origin commits. */
export function canPublish(row: PublishGateRow, kind: BumpKind = 'patch'): boolean {
	return !whyNotPublish(row, kind);
}

export const FLEET_WRITE_ORDER = ['commit', 'publish', 'push', 'pins'] as const;
export type FleetWriteId = (typeof FLEET_WRITE_ORDER)[number];

export function canCommit(row: { missing?: boolean; git: GateGit }): boolean {
	if (row.missing) return false;
	if (!row.git.repo) return false;
	if (row.git.busy) return false;
	return Boolean(row.git.dirty);
}

/** Optional deploy. Not a gold Today need — private sites can always ship. */
export function canShip(row: { missing?: boolean; ship?: { dir: string } }): boolean {
	return Boolean(!row.missing && row.ship);
}

export type GlobalGateRow = {
	missing?: boolean;
	private?: boolean;
	unpublishedAhead?: boolean;
	localVersion: string | null;
	npm: { name?: string; latest?: string };
	bin?: string[];
	global?: { version: string | null };
};

export function canGlobal(row: GlobalGateRow): boolean {
	return Boolean(!row.missing && !row.private && row.npm.name && row.bin?.length);
}

export function globalTargetVersion(row: GlobalGateRow): string | undefined {
	if (row.unpublishedAhead && row.localVersion) return row.localVersion;
	return row.npm.latest ?? row.localVersion ?? undefined;
}

/** Global copy missing or behind the version this machine should run. Not a gold Today need. */
export function needsGlobal(row: GlobalGateRow): boolean {
	if (!canGlobal(row)) return false;
	const want = globalTargetVersion(row);
	if (!want) return false;
	return (row.global?.version ?? null) !== want;
}

export function globalWriteLabel(row: GlobalGateRow): string {
	const want = globalTargetVersion(row);
	const have = row.global?.version;
	if (want && have) return `Update global ${want}`;
	if (want) return `Install global ${want}`;
	return 'Install global';
}

export type GlobalInstallLineRow = {
	id: string;
	action?: string;
	reason?: string;
	npm?: string;
	version?: string | null;
	have?: string | null;
};

/** Prefix the id only when several subjects are listed. A lone `localhelm  pnpm …` reads like a CLI. */
export function confirmNamedLine(id: string, detail: string, named: boolean): string {
	return named ? `${id}  ${detail}` : detail;
}

export function shipConfirmLine(
	row: { id: string; action?: string; reason?: string; dir?: 'root' | 'site' },
	named: boolean,
): string {
	if (row.action && row.action !== 'ship') return `${row.id}  ${row.reason ?? 'skipped'}`;
	const where = row.dir === 'site' ? 'site/' : 'root';
	return confirmNamedLine(row.id, `pnpm run ship (${where})`, named);
}

export function globalInstallLine(row: GlobalInstallLineRow, named = false): string {
	if (row.action && row.action !== 'global') return `${row.id}  ${row.reason ?? 'skipped'}`;
	const name = row.npm ?? row.id;
	const spec = `${name}@${row.version ?? '?'}`;
	const have = row.have ? ` (have ${row.have})` : '';
	return confirmNamedLine(row.id, `pnpm add -g ${spec}${have}`, named);
}

export function npmNotReadyReason(name: string, version: string): string {
	return `${name}@${version} is not on npm yet`;
}

export function isNpmNotReadyReason(reason: string | undefined): boolean {
	return Boolean(reason?.includes(' is not on npm yet'));
}

export function npmNotReadyTitle(rows: ReadonlyArray<{ npm?: string; version?: string | null }>): string {
	if (rows.length === 1) {
		const row = rows[0];
		return `npm does not have ${row?.npm ?? 'package'}@${row?.version ?? '?'} yet`;
	}
	return `npm does not have ${rows.length} new versions yet`;
}

export const NPM_NOT_READY_HINT =
	'A new publish can take a minute to show up. Wait for the registry, or try again now.';

export function npmNotReadyHint(): string {
	return NPM_NOT_READY_HINT;
}

/** Writes Today and Fleet both offer. Order is the gold-write priority. */
export function fleetWriteIds(row: PublishGateRow, writablePins = 0): FleetWriteId[] {
	const ids: FleetWriteId[] = [];
	if (canCommit(row)) ids.push('commit');
	if (canPublish(row)) ids.push('publish');
	if ((row.git.ahead ?? 0) > 0 && !whyNotPush(row.git)) ids.push('push');
	if (writablePins > 0) ids.push('pins');
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
	if (id === 'commit') return 'Commit';
	if (id === 'publish') {
		const version = row.unpublishedAhead
			? (row.localVersion ?? '')
			: (nextCutVersion(row, kind) ?? row.localVersion ?? '');
		const commits = row.unpublishedAhead ? '' : commitCountLabel(row.commitsSinceNpm);
		if (version && commits) return `Publish ${version} · ${commits}`;
		if (version) return `Publish ${version}`;
		if (commits) return `Publish · ${commits}`;
		return 'Publish';
	}
	if (id === 'push') {
		const commits = commitCountLabel(row.git.ahead);
		return commits ? `Push ${commits}` : 'Push';
	}
	if (writablePins === 1) return 'Write 1 pin';
	if (writablePins > 1) return `Write ${writablePins} pins`;
	return 'Write pins';
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

/** Enrolled publishers whose registry pin on this consumer is behind npm latest. */
export function behindPinPublisherIds(
	pins: ReadonlyArray<{ kind: string; onLatest?: boolean; targetId?: string }>,
): string[] {
	const ids: string[] = [];
	const seen = new Set<string>();
	for (const pin of pins) {
		if (pin.kind !== 'registry' || pin.onLatest !== false || !pin.targetId) continue;
		if (seen.has(pin.targetId)) continue;
		seen.add(pin.targetId);
		ids.push(pin.targetId);
	}
	return ids;
}
