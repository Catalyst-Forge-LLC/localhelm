/** Confirm copy and roster lines. No Node imports — safe for the Svelte bundle. */

import type { ConfirmPhase } from './confirmProgress.js';
import { globalInstallLine, shipConfirmLine, type GlobalInstallLineRow } from './fleetWrites.js';
import { publishNeedsGithub, publishStepLabel } from './publishDisplay.js';
import type { PublishStep } from './publishTypes.js';

export type ConfirmOffer = {
	title: string;
	hint: string;
	items: string[];
	itemKeys?: string[];
	applyIds?: string[];
	confirmLabel: string;
	variant?: 'write' | 'danger';
	canApply: boolean;
	showOtp?: boolean;
	messages?: Record<string, string>;
	/** Confirm item key (`id:index`) → text diff. */
	diffs?: Record<string, string>;
	draftHint?: string;
	altLabel?: string;
	itemPhases?: ConfirmPhase[];
	/** Parallel to `items`. Push confirms use commit, then that commit's files. */
	itemKinds?: ('commit' | 'file' | 'link' | undefined)[];
	/** Optional confirm checkbox. Off unless the operator ticks it. */
	extraCheck?: { label: string; hint: string };
	run?: (includedIds: string[]) => void;
	alt?: (includedIds: string[]) => void;
	oncancel?: () => void;
};

export type JobRunOpts = {
	closeConfirm?: boolean;
	openConfirm?: boolean | { title?: string; hint?: string; itemKeys?: string[] };
};

/** Shown while the plan is still running, before the confirm copy replaces it. */
export function planningHint(title: string): string {
	switch (title) {
		case 'Bump':
			return 'Writes package.json and commits that file. Other dirty files stay local. No tag, no push, no publish.';
		case 'Commit':
			return 'Confirm runs git add and git commit. Secrets stay out. No push.';
		case 'Pull':
			return 'git pull --ff-only. Dirty or diverged trees are skipped.';
		case 'Push':
			return 'git push origin only. Never --force. Never the IngotVault backup remote. Uncommitted files stay in the working tree.';
		case 'Ship':
			return 'Runs pnpm ship in each checkout (wrangler / Pages). Not FilePress Land. Never --force.';
		case 'Install globally':
			return 'Checks npm for that version, then runs pnpm add -g (npm if pnpm is missing). Never --force.';
		case 'Publish':
			return 'Bumps if local already matches npm, pushes if needed, then npm publish. GitHub Actions packages open a workflow link instead. Never --force.';
		case 'Cascade':
			return 'Writes pins and lockfiles in clean dependents, then commits those files.';
		case 'Land':
			return 'Syncs getfilepress on the site, then Push and Ship. Does not publish a fleet package.';
		case 'Clear demo':
			return 'Deletes localhelm.fleet.demo.json and .localhelm/demo/. The live fleet is not touched.';
		case 'Restore on Today':
			return 'Puts these rows back on Today. The folder was never moved.';
		case 'Hide on Today':
			return 'Hides on Today. The folder and port stay.';
		case 'Remove from fleet':
			return 'Rewrites localhelm.fleet.json without these rows. Never deletes a folder.';
		case 'Export':
			return 'Overwrites the inventory JSON file. Does not change any project.';
		default:
			return 'Checking what this would do.';
	}
}

export function planOpts(
	title: string,
	itemKeys?: string[],
	hint?: string,
): {
	closeConfirm: false;
	openConfirm: { title: string; hint: string; itemKeys?: string[] };
} {
	return {
		closeConfirm: false,
		openConfirm: {
			title,
			hint: hint || planningHint(title),
			...(itemKeys?.length ? { itemKeys } : {}),
		},
	};
}

export type CommitPlanFile = { path: string; from?: string; code: string; skip?: string };

export type CommitPlanRow = {
	id: string;
	action: string;
	reason?: string;
	files: CommitPlanFile[];
	diffs?: Record<string, string>;
	message: string;
	suggestSource?: string;
	suggestNote?: string;
	suggestModel?: string;
	suggestHost?: string;
};

export type PublishBatchRow = {
	id: string;
	action: string;
	reason?: string;
	version?: string | null;
	npm?: string;
};

export function dirtPlanLine(file: CommitPlanFile): string {
	const mark = file.code.trim() || '??';
	if (file.skip) return `skip  ${file.path}  (${file.skip})`;
	if (file.from) return `${mark}  ${file.from} → ${file.path}`;
	return `${mark}  ${file.path}`;
}

export type PushConfirmRow = {
	id: string;
	action: string;
	reason?: string;
	ahead?: number | null;
	branch?: string | null;
	origin?: string | null;
	commits?: { hash: string; subject: string; files?: { code: string; path: string; from?: string }[] }[];
	files?: { code: string; path: string; from?: string }[];
	diffs?: Record<string, string>;
};

export type PushConfirmEntries = {
	items: string[];
	itemKeys: string[];
	itemKinds: ('commit' | 'file' | 'link' | undefined)[];
	diffs: Record<string, string>;
};

/** Roster lines for a push confirm. Each commit is followed by that commit's files. */
export function pushConfirmEntries(rows: PushConfirmRow[]): PushConfirmEntries {
	const items: string[] = [];
	const itemKeys: string[] = [];
	const itemKinds: PushConfirmEntries['itemKinds'] = [];
	const diffs: Record<string, string> = {};
	const named = rows.length > 1;
	for (const row of rows) {
		const commits = row.commits ?? [];
		const loose = commits.some((commit) => commit.files?.length) ? [] : (row.files ?? []);
		if (row.action !== 'push' || (commits.length === 0 && loose.length === 0)) {
			items.push(row.action === 'push' ? (pushItems([row])[0] ?? row.id) : `${row.id}  ${row.reason ?? 'skipped'}`);
			itemKeys.push(row.id);
			itemKinds.push(undefined);
			continue;
		}
		const steps: { line: string; kind: 'commit' | 'file' | 'link'; diff?: string }[] = [];
		if (row.origin) steps.push({ kind: 'link', line: `→  ${row.origin}` });
		const listed = commits.length ? commits : [{ hash: '', subject: '', files: loose }];
		for (let n = 0; n < listed.length; n += 1) {
			const commit = listed[n]!;
			if (commit.hash) {
				steps.push({
					kind: 'commit',
					line: `${commit.hash}  ${commit.subject}`,
					diff: row.diffs?.[`commit:${commit.hash}`],
				});
			}
			const ownedFiles = commit.files?.length ? commit.files : n === 0 ? loose : [];
			for (const file of ownedFiles) {
				const line = file.from ? `${file.code}  ${file.from} → ${file.path}` : `${file.code}  ${file.path}`;
				steps.push({
					kind: 'file',
					line,
					diff: row.diffs?.[`file:${commit.hash}:${file.path}`] ?? row.diffs?.[`file:${file.path}`],
				});
			}
		}
		steps.forEach((step, index) => {
			items.push(named ? `${row.id}  ${step.line}` : step.line);
			const key = `${row.id}:${index}`;
			itemKeys.push(key);
			itemKinds.push(step.kind);
			if (step.diff) diffs[key] = step.diff;
		});
	}
	return { items, itemKeys, itemKinds, diffs };
}

export type PublishConfirmRow = {
	id: string;
	npm?: string;
	version: string | null;
	steps: PublishStep[];
};

export function pushItems(rows: PushConfirmRow[]): string[] {
	return rows.map((row) => {
		if (row.action !== 'push') {
			return `${row.id}  ${row.reason ?? 'skipped'}`;
		}
		const n = row.ahead ?? '?';
		return `${row.id}  ${row.branch ?? '?'}  ${n} commit(s)\n→  ${row.origin ?? ''}`;
	});
}

export function shipItems(rows: Parameters<typeof shipConfirmLine>[0][]): string[] {
	const named = rows.length > 1;
	return rows.map((row) => shipConfirmLine(row, named));
}

export function globalItems(rows: GlobalInstallLineRow[]): string[] {
	const named = rows.length > 1;
	return rows.map((row) => globalInstallLine(row, named));
}

export function publishItems(row: PublishConfirmRow, named: boolean): string[] {
	return row.steps.map((step, i) => {
		const line = `${i + 1}. ${publishStepLabel(step)}`;
		return named ? `${row.id}  ${line}` : line;
	});
}

export function publishItemKeys(row: PublishConfirmRow): string[] {
	return row.steps.map((_, i) => `${row.id}:${i}`);
}

export function slimPublishRows(rows: PublishBatchRow[]): unknown[] {
	return rows.map((row) => ({
		id: row.id,
		action: row.action,
		version: row.version,
		reason: row.reason,
	}));
}

export function githubPendingRows(plan: PublishConfirmRow[], remaining: string[]): PublishBatchRow[] {
	const want = new Set(remaining);
	return plan
		.filter((row) => want.has(row.id) && publishNeedsGithub(row.steps))
		.map((row) => {
			const step = row.steps.find((item) => item.kind === 'github');
			const url = step?.kind === 'github' ? step.url : '';
			return {
				id: row.id,
				action: 'publish',
				version: row.version,
				npm: row.npm,
				reason: url
					? `open GitHub Publish ${row.npm ?? row.id}@${row.version}  ${url}`
					: `GitHub Publish ${row.id} was not opened`,
			};
		});
}

export function firstPlanReason(data: unknown): string {
	if (!data || typeof data !== 'object') return '';
	const rows = (data as { rows?: unknown }).rows;
	if (!Array.isArray(rows) || !rows[0] || typeof rows[0] !== 'object') return '';
	const reason = (rows[0] as { reason?: unknown }).reason;
	return typeof reason === 'string' ? reason : '';
}

/** One readable line per check finding. */
export function checkResultLines(detail: string): string[] {
	const parts = detail
		.split(' · ')
		.map((part) => part.trim())
		.filter(Boolean);
	if (!parts.length) return ['Check failed'];
	return parts.map((part) => {
		if (part === 'no APP_FACTS.md') return 'Missing AppFacts';
		if (part.includes('no .featurefacts/features.yaml')) return 'Missing FeatureFacts';
		if (part === 'FeatureFacts register is empty') return 'FeatureFacts has no capabilities';
		const skill = /missing (\S*SKILL_FACTS\.md)/i.exec(part);
		if (skill?.[1]) return `Missing SkillFacts (${skill[1]})`;
		if (/is stale \(file=/i.test(part)) return 'AppFacts fingerprint is stale';
		if (/inputs_fingerprint/i.test(part)) return 'AppFacts has no fingerprint';
		return part;
	});
}

/** Which follow-up a check detail can take. A row can need both. */
export function checkResultFollowUp(detail: string): { add: boolean; update: boolean } {
	const update = /inputs_fingerprint|is stale \(file=/i.test(detail);
	const add = /no APP_FACTS\.md|no \.featurefacts\/features\.yaml|FeatureFacts register is empty|SKILL_FACTS\.md/i.test(detail);
	return { add, update };
}

export function pluginJobHint(
	plugin: string,
	action: string,
	applyIds: string[],
	writeIds: string[] | null,
	data?: unknown,
): string {
	if (!applyIds.length) {
		if (plugin === 'localslip') {
			const reason = firstPlanReason(data);
			if (reason.includes('no recipe') || reason.includes('no matching folder')) {
				return 'Start needs a folder and a command. The lease name may not match the checkout (temperpass-site → temper-pass, or dictawhisper-api → dictawhisper). No sibling matched this name.';
			}
			if (reason.includes('already listening')) return 'Already running on this lease.';
			if (reason.includes('not running')) return 'Nothing is listening on this lease.';
			if (reason.includes('park')) return 'Park hides the lease. The port stays yours. Unpark does not start.';
			if (action === 'quiet') return 'No listening *-site leases. The dashboard is left alone.';
			if (action === 'recipe-all') return 'Every lease already has a recipe, or no sibling folder matched.';
			return reason || 'Nothing to start or stop.';
		}
		return writeIds ? 'Already current — nothing to write.' : 'The plan found nothing to do.';
	}
	if (plugin === 'localslip') {
		if (action === 'stop') {
			return 'LocalSlip stops the process tree on this lease. The lease stays. Observed-only rows are not killed.';
		}
		if (action === 'park') {
			return 'Stops if we started it, then hides the lease. The port stays yours. Not a release.';
		}
		if (action === 'unpark') {
			return 'Shows the lease again. Does not start it.';
		}
		if (action === 'recipe' || action === 'recipe-all') {
			return 'Saves the guessed folder and command. Does not start.';
		}
		if (action === 'quiet') {
			return 'Stops listening *-site leases. The dashboard stays up. Not a release.';
		}
		const rows = data && typeof data === 'object' ? (data as { rows?: unknown }).rows : null;
		const first = Array.isArray(rows) && rows[0] && typeof rows[0] === 'object' ? (rows[0] as Record<string, unknown>) : null;
		if (typeof first?.proposedCwd === 'string') {
			return 'No recipe stored yet. Confirm saves this guess (folder + command) and starts. You can change it later with localslip recipe.';
		}
		return 'LocalSlip starts the lease recipe (default pnpm serve) detached. Closing LocalHelm does not stop it.';
	}
	if (plugin === 'filepress' && (action === 'enroll' || action === 'enroll-from')) {
		return 'Writes FilePress extras.json for folders with getfilepress and filepress.config.ts. Workspace siblings already appear. Folder stays put.';
	}
	if (action === 'push') {
		return 'git push origin <branch> only. Never --force. Never the IngotVault backup remote.';
	}
	if (plugin === 'xfacts' && action === 'check') {
		return 'Reads each repo. Does not write. Confirm checks app, feature, skill, tool, agent, and model. AppFacts and a FeatureFacts register are required. SkillFacts is required next to SKILL.md. Tool, agent, and model are checked when those files exist.';
	}
	if (plugin === 'xfacts' && action === 'ship') {
		return 'Runs pnpm ship in that repo (wrangler / Pages). Confirm to deploy. Not FilePress Land. Never --force.';
	}
	return 'The plugin runs this in each listed checkout. LocalHelm does not reimplement it.';
}
