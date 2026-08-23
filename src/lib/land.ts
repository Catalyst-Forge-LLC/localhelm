import { applyPull, applyPush, planPull, planPush, type GitJobRow } from './git.js';
import type { LoadedManifest } from './manifest.js';
import { loadPlugins, requirePlugin, type HelmPlugin } from './plugin.js';
import { pluginPlanWriteIds } from './pluginPlan.js';
import { applyPublish, planPublish, type PublishRow } from './publish.js';
import { fleetStatus } from './status.js';
import type { FleetInventory, ProjectStatus } from './types.js';
import { plainGitError, whyNotPublish } from './writeGate.js';

export const LAND_ENGINE_ID = 'filepress';
export const LAND_PLUGIN_ID = 'filepress';

export type LandRole = 'engine' | 'companion' | 'site';

export type LandStepKind = 'pull' | 'push' | 'publish' | 'sync' | 'site-push' | 'ship';

export type LandStep = {
	kind: LandStepKind;
	role: LandRole;
	target: string;
	label: string;
	gitRow?: GitJobRow;
	publishRow?: PublishRow;
	pluginAction?: 'sync' | 'push' | 'ship';
};

export type LandPlan = {
	siteId: string;
	engineId: string;
	companionId: string | null;
	steps: LandStep[];
	needsPublish: boolean;
	note: string;
};

export type LandApplyResult = {
	siteId: string;
	ok: boolean;
	steps: Array<LandStep & { ok: boolean; reason: string }>;
	stoppedAt?: string;
};

/** Exact fleet id, or strip a trailing `-site`. Never the engine id (engine is always its own role). */
export function companionIdForSite(
	siteId: string,
	enrolledIds: Iterable<string>,
	engineId: string = LAND_ENGINE_ID,
): string | null {
	const enrolled = new Set(enrolledIds);
	const candidates: string[] = [];
	if (enrolled.has(siteId)) candidates.push(siteId);
	if (siteId.endsWith('-site')) {
		const base = siteId.slice(0, -'-site'.length);
		if (base && enrolled.has(base) && !candidates.includes(base)) candidates.push(base);
	}
	for (const id of candidates) {
		if (id !== engineId) return id;
	}
	return null;
}

export function requireLandSiteId(siteId: string | undefined): string {
	const named = (siteId ?? '').trim();
	if (!named) {
		throw new Error('name the FilePress site id to land. LocalHelm will not land every site in one apply.');
	}
	return named;
}

function packageLabel(role: LandRole, id: string, kind: LandStepKind, detail: string): string {
	const who = role === 'engine' ? `engine ${id}` : `package ${id}`;
	if (kind === 'pull') return `${who}: pull (${detail})`;
	if (kind === 'push') return `${who}: push (${detail})`;
	return `${who}: publish (${detail})`;
}

async function packageSteps(
	loaded: LoadedManifest,
	inventory: FleetInventory,
	id: string,
	role: LandRole,
): Promise<LandStep[]> {
	const row = inventory.projects.find((p) => p.id === id);
	if (!row) return [];

	const steps: LandStep[] = [];
	const pullRows = await planPull(loaded);
	const pull = pullRows.find((r) => r.id === id && r.action === 'pull');
	if (pull) {
		steps.push({
			kind: 'pull',
			role,
			target: id,
			label: packageLabel(role, id, 'pull', pull.reason ?? 'behind'),
			gitRow: pull,
		});
	}

	// Publish only when already unpublished-ahead (no opportunistic version cut).
	if (row.unpublishedAhead && !whyNotPublish(row)) {
		const planned = await planPublish(loaded, [id], 'patch');
		const pub = planned[0];
		if (pub?.action === 'publish') {
			steps.push({
				kind: 'publish',
				role,
				target: id,
				label: packageLabel(role, id, 'publish', pub.reason ?? row.localVersion ?? 'publish'),
				publishRow: pub,
			});
			return steps;
		}
	}

	const plannedPush = await planPush(loaded, [id]);
	const push = plannedPush[0];
	if (push?.action === 'push') {
		steps.push({
			kind: 'push',
			role,
			target: id,
			label: packageLabel(role, id, 'push', push.reason ?? `${push.ahead ?? '?'} ahead`),
			gitRow: push,
		});
	}
	return steps;
}

function pluginWrites(plan: unknown, siteId: string): boolean {
	const ids = pluginPlanWriteIds(plan);
	if (ids) return ids.includes(siteId);
	if (!plan || typeof plan !== 'object') return false;
	const rows = (plan as { rows?: unknown }).rows;
	if (!Array.isArray(rows)) return false;
	return rows.some((row) => {
		if (!row || typeof row !== 'object') return false;
		const body = row as { id?: unknown; action?: unknown; writes?: unknown };
		return body.id === siteId && body.action !== 'skip' && body.writes !== false;
	});
}

function pluginStepLabel(action: 'sync' | 'push' | 'ship', siteId: string, plan: unknown): string {
	if (action === 'sync') return `site ${siteId}: sync engine`;
	if (action === 'ship') return `site ${siteId}: ship`;
	if (!plan || typeof plan !== 'object') return `site ${siteId}: push`;
	const rows = (plan as { rows?: Array<{ id?: string; reason?: string }> }).rows;
	const row = rows?.find((r) => r.id === siteId);
	return `site ${siteId}: push (${row?.reason ?? 'origin'})`;
}

async function siteSteps(plugin: HelmPlugin, siteId: string): Promise<LandStep[]> {
	if (!plugin.plan) return [];
	const steps: LandStep[] = [];
	for (const action of ['sync', 'push', 'ship'] as const) {
		const plan = await plugin.plan(action, [siteId]);
		if (!pluginWrites(plan, siteId)) continue;
		steps.push({
			kind: action === 'push' ? 'site-push' : action,
			role: 'site',
			target: siteId,
			label: pluginStepLabel(action, siteId, plan),
			pluginAction: action,
		});
	}
	return steps;
}

/** Shared with applyLand — FilePress bridge returns `{ results: [{ ok }] }`. */
export function landPluginApplyOk(result: unknown): { ok: boolean; reason: string } {
	if (!result || typeof result !== 'object') return { ok: true, reason: 'done' };
	const body = result as { results?: Array<{ id?: string; ok?: boolean }>; log?: string[] };
	if (Array.isArray(body.results)) {
		const failed = body.results.filter((row) => row.ok === false);
		if (failed.length) {
			const ids = failed.map((row) => row.id ?? '?').join(', ');
			const log = Array.isArray(body.log) ? body.log.slice(-3).join(' · ') : '';
			return { ok: false, reason: log || `plugin failed for ${ids}` };
		}
	}
	return { ok: true, reason: 'done' };
}

export async function planLand(loaded: LoadedManifest, siteIdRaw: string): Promise<LandPlan> {
	const siteId = requireLandSiteId(siteIdRaw);
	const inventory = await fleetStatus(loaded);
	const enrolled = inventory.projects.map((p) => p.id);
	const companionId = companionIdForSite(siteId, enrolled, LAND_ENGINE_ID);
	const plug = requirePlugin(await loadPlugins(loaded), LAND_PLUGIN_ID);

	const steps: LandStep[] = [];
	if (enrolled.includes(LAND_ENGINE_ID)) {
		steps.push(...(await packageSteps(loaded, inventory, LAND_ENGINE_ID, 'engine')));
	}
	if (companionId) {
		steps.push(...(await packageSteps(loaded, inventory, companionId, 'companion')));
	}
	steps.push(...(await siteSteps(plug.plugin, siteId)));

	const needsPublish = steps.some((s) => s.kind === 'publish');
	const note = steps.length
		? 'Does the writes that are already needed, in order. Engine package, matching fleet package, then this site.'
		: `${siteId} is already current — nothing to land.`;

	return {
		siteId,
		engineId: LAND_ENGINE_ID,
		companionId,
		steps,
		needsPublish,
		note,
	};
}

export async function applyLand(
	loaded: LoadedManifest,
	plan: LandPlan,
	opts: { otp?: string } = {},
): Promise<LandApplyResult> {
	const plug = requirePlugin(await loadPlugins(loaded), LAND_PLUGIN_ID);
	const out: LandApplyResult = { siteId: plan.siteId, ok: true, steps: [] };

	for (const step of plan.steps) {
		if (step.kind === 'pull' && step.gitRow) {
			const next = applyPull(loaded.workspaceRoot, step.gitRow);
			const ok = next.reason === 'pulled ff-only';
			out.steps.push({ ...step, ok, reason: ok ? next.reason! : plainGitError(next.reason ?? next.stderr ?? 'pull failed') });
			if (!ok) {
				out.ok = false;
				out.stoppedAt = step.label;
				return out;
			}
			continue;
		}
		if (step.kind === 'push' && step.gitRow) {
			const next = applyPush(loaded.workspaceRoot, step.gitRow);
			const ok = next.reason === 'pushed';
			out.steps.push({
				...step,
				ok,
				reason: ok ? 'pushed' : plainGitError(next.reason ?? next.stderr ?? 'push failed'),
			});
			if (!ok) {
				out.ok = false;
				out.stoppedAt = step.label;
				return out;
			}
			continue;
		}
		if (step.kind === 'publish' && step.publishRow) {
			const next = await applyPublish(loaded, step.publishRow, { otp: opts.otp });
			const ok = Boolean(next.reason?.startsWith('published '));
			out.steps.push({
				...step,
				ok,
				reason: ok ? next.reason! : plainGitError(next.reason ?? next.stderr ?? 'publish failed'),
			});
			if (!ok) {
				out.ok = false;
				out.stoppedAt = step.label;
				return out;
			}
			continue;
		}
		if (step.pluginAction) {
			if (!plug.plugin.apply) {
				out.steps.push({ ...step, ok: false, reason: 'plugin has no apply' });
				out.ok = false;
				out.stoppedAt = step.label;
				return out;
			}
			const result = await plug.plugin.apply(step.pluginAction, [plan.siteId]);
			const check = landPluginApplyOk(result);
			out.steps.push({ ...step, ok: check.ok, reason: check.reason });
			if (!check.ok) {
				out.ok = false;
				out.stoppedAt = step.label;
				return out;
			}
			continue;
		}
		out.steps.push({ ...step, ok: false, reason: 'unknown step' });
		out.ok = false;
		out.stoppedAt = step.label;
		return out;
	}
	return out;
}

/** Test helper: does this inventory row look like a Land publish need? */
export function landWouldPublish(row: ProjectStatus): boolean {
	return Boolean(row.unpublishedAhead && !whyNotPublish(row));
}
