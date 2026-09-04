import type { GitJobRow } from './git.js';
import type { LoadedManifest } from './manifest.js';
import { loadPlugins, requirePlugin } from './plugin.js';
import type { PublishRow } from './publish.js';
import type { ProjectStatus } from './types.js';
import { landPluginApplyOk, whyNotPublish } from './writeGate.js';
import { readLandShipFingerprint, recordLandShip, shipUnchanged } from './landShips.js';

export { landPluginApplyOk };

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
	/** Present on ship steps — recorded after a successful ship so the next Land can skip. */
	shipFingerprint?: string;
};

export type LandPlan = {
	siteId: string;
	engineId: string;
	companionId: string | null;
	steps: LandStep[];
	needsPublish: boolean;
	needsOtp: boolean;
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
		throw new Error('name the FilePress site id to land. LocalHelm will not land every site unless you name them.');
	}
	return named;
}

export function requireLandSiteIds(ids: readonly string[] | undefined): string[] {
	const named = [...new Set((ids ?? []).map((id) => id.trim()).filter(Boolean))];
	if (!named.length) {
		throw new Error('name the FilePress site id(s) to land. LocalHelm will not land every site unless you name them.');
	}
	return named.map((id) => requireLandSiteId(id));
}

export type LandPluginRow = {
	id?: string;
	sync?: { writes?: boolean };
	push?: { writes?: boolean; reason?: string; action?: string };
	ship?: { writes?: boolean; fingerprint?: string | null; script?: string | null };
};

export function landRequestSiteIds(body: { siteId?: unknown; siteIds?: unknown }): string[] {
	const listed = Array.isArray(body.siteIds) ? body.siteIds.filter((id): id is string => typeof id === 'string') : [];
	const one = typeof body.siteId === 'string' ? [body.siteId] : [];
	return requireLandSiteIds([...listed, ...one]);
}

export function landStepsFromPluginRow(
	siteId: string,
	row: LandPluginRow | null | undefined,
	lastShipFingerprint: string | null,
): LandStep[] {
	if (!row) return [];
	const steps: LandStep[] = [];
	if (row.sync?.writes) {
		steps.push({
			kind: 'sync',
			role: 'site',
			target: siteId,
			label: `site ${siteId}: sync engine`,
			pluginAction: 'sync',
		});
	}
	if (row.push?.writes || row.push?.action === 'push') {
		steps.push({
			kind: 'site-push',
			role: 'site',
			target: siteId,
			label: `site ${siteId}: push (${row.push.reason ?? 'origin'})`,
			pluginAction: 'push',
		});
	}
	if (row.ship?.writes) {
		const fingerprint = row.ship.fingerprint ?? null;
		if (shipUnchanged(lastShipFingerprint, fingerprint)) {
			/* already shipped this tree — skip */
		} else {
			steps.push({
				kind: 'ship',
				role: 'site',
				target: siteId,
				label: fingerprint
					? `site ${siteId}: ship`
					: `site ${siteId}: ship (${row.ship.script ?? 'pnpm ship'})`,
				pluginAction: 'ship',
				shipFingerprint: fingerprint ?? undefined,
			});
		}
	}
	return steps;
}

function pluginLandRows(planned: unknown): LandPluginRow[] {
	const rows = planned && typeof planned === 'object' ? (planned as { rows?: LandPluginRow[] }).rows : null;
	return Array.isArray(rows) ? rows : [];
}

function rowForSite(rows: LandPluginRow[], siteId: string, namedCount: number): LandPluginRow | undefined {
	const exact = rows.find((r) => r.id === siteId);
	if (exact) return exact;
	return namedCount === 1 ? rows[0] : undefined;
}

export const LAND_PLAN_NOTE =
	'Syncs getfilepress on this site, then pushes and ships. Does not publish the filepress package. Ship is skipped when the tree matches the last successful ship.';

function landPlanForSite(
	siteId: string,
	enrolledAll: readonly string[],
	steps: LandStep[],
): LandPlan {
	return {
		siteId,
		engineId: LAND_ENGINE_ID,
		companionId: companionIdForSite(siteId, enrolledAll, LAND_ENGINE_ID),
		steps,
		needsPublish: false,
		needsOtp: false,
		note: steps.length ? LAND_PLAN_NOTE : `${siteId} is already current — nothing to land.`,
	};
}

export async function planLandMany(loaded: LoadedManifest, idsRaw: readonly string[]): Promise<LandPlan[]> {
	const siteIds = requireLandSiteIds(idsRaw);
	const enrolledAll = loaded.manifest.projects.map((p) => p.id);
	const plug = requirePlugin(await loadPlugins(loaded), LAND_PLUGIN_ID);
	const planned = plug.plugin.plan ? await plug.plugin.plan('land', siteIds) : null;
	const rows = pluginLandRows(planned);
	const lasts = await Promise.all(siteIds.map((id) => readLandShipFingerprint(loaded.workspaceRoot, id)));
	return siteIds.map((siteId, i) => {
		const steps = landStepsFromPluginRow(siteId, rowForSite(rows, siteId, siteIds.length), lasts[i] ?? null);
		return landPlanForSite(siteId, enrolledAll, steps);
	});
}

export async function planLand(loaded: LoadedManifest, siteIdRaw: string): Promise<LandPlan> {
	const plans = await planLandMany(loaded, [requireLandSiteId(siteIdRaw)]);
	const plan = plans[0];
	if (!plan) {
		throw new Error('name the FilePress site id to land. LocalHelm will not land every site unless you name them.');
	}
	return plan;
}

export type LandStepEvent = {
	id: string;
	index: number;
	status: 'start' | 'done' | 'fail';
	reason?: string;
};

export async function applyLand(
	loaded: LoadedManifest,
	plan: LandPlan,
	opts: { otp?: string; onStep?: (event: LandStepEvent) => void } = {},
): Promise<LandApplyResult> {
	const plug = requirePlugin(await loadPlugins(loaded), LAND_PLUGIN_ID);
	const out: LandApplyResult = { siteId: plan.siteId, ok: true, steps: [] };

	for (let index = 0; index < plan.steps.length; index++) {
		const step = plan.steps[index]!;
		opts.onStep?.({ id: plan.siteId, index, status: 'start' });
		if (step.pluginAction) {
			if (!plug.plugin.apply) {
				out.steps.push({ ...step, ok: false, reason: 'plugin has no apply' });
				out.ok = false;
				out.stoppedAt = step.label;
				opts.onStep?.({ id: plan.siteId, index, status: 'fail', reason: 'plugin has no apply' });
				return out;
			}
			const result = await plug.plugin.apply(step.pluginAction, [plan.siteId]);
			const check = landPluginApplyOk(result);
			out.steps.push({ ...step, ok: check.ok, reason: check.reason });
			opts.onStep?.({
				id: plan.siteId,
				index,
				status: check.ok ? 'done' : 'fail',
				reason: check.ok ? undefined : check.reason,
			});
			if (!check.ok) {
				out.ok = false;
				out.stoppedAt = step.label;
				return out;
			}
			if (step.pluginAction === 'ship' && step.shipFingerprint) {
				await recordLandShip(loaded.workspaceRoot, plan.siteId, step.shipFingerprint);
			}
			continue;
		}
		out.steps.push({ ...step, ok: false, reason: 'unknown step' });
		out.ok = false;
		out.stoppedAt = step.label;
		opts.onStep?.({ id: plan.siteId, index, status: 'fail', reason: 'unknown step' });
		return out;
	}
	return out;
}

/** Test helper: does this inventory row look like a Land publish need? */
export function landWouldPublish(row: ProjectStatus): boolean {
	return Boolean(row.unpublishedAhead && !whyNotPublish(row));
}
