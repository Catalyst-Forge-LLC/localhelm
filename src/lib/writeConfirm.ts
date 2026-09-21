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
	/** Confirm item key (`id:index`) → text diff. Commit confirm only. */
	diffs?: Record<string, string>;
	draftHint?: string;
	altLabel?: string;
	itemPhases?: ConfirmPhase[];
	run?: (includedIds: string[]) => void;
	alt?: (includedIds: string[]) => void;
	oncancel?: () => void;
};

export type JobRunOpts = {
	closeConfirm?: boolean;
	openConfirm?: boolean | { title?: string; hint?: string; itemKeys?: string[] };
};

export function planOpts(
	title: string,
	itemKeys?: string[],
): {
	closeConfirm: false;
	openConfirm: { title: string; itemKeys?: string[] };
} {
	return { closeConfirm: false, openConfirm: { title, ...(itemKeys?.length ? { itemKeys } : {}) } };
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
};

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
	if (action === 'push') {
		return 'git push origin <branch> only. Never --force. Never the IngotVault backup remote.';
	}
	if (plugin === 'xfacts' && action === 'ship') {
		return 'Runs pnpm ship in that repo (wrangler / Pages). Confirm to deploy. Not FilePress Land. Never --force.';
	}
	return 'The plugin runs this in each listed checkout. LocalHelm does not reimplement it.';
}
