import type { GitJobRow } from './git.js';
import type { LoadedManifest } from './manifest.js';
import { loadPlugins, requirePlugin } from './plugin.js';
import type { PublishRow } from './publish.js';
import type { ProjectStatus } from './types.js';
import { landPluginApplyReport } from './plainError.js';
import { landPluginApplyOk, whyNotPublish } from './writeGate.js';
import { markLandShipFailed, readLandShips, recordLandShip, shipUnchanged } from './landShips.js';

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
	pendingShip = false,
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
		if (!pendingShip && shipUnchanged(lastShipFingerprint, fingerprint)) {
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
	const ships = await readLandShips(loaded.workspaceRoot);
	return siteIds.map((siteId) => {
		const rec = ships.sites[siteId];
		const last = rec?.fingerprint?.trim() || null;
		const steps = landStepsFromPluginRow(
			siteId,
			rowForSite(rows, siteId, siteIds.length),
			last,
			Boolean(rec?.pending),
		);
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

/** Sites handed to one FilePress bridge process. Ship runs this many `pnpm ship`s together. */
export const LAND_BATCH_WIDTH = 3;

const LAND_WAVES = ['sync', 'push', 'ship'] as const;
type LandWave = (typeof LAND_WAVES)[number];

function landChunks<T>(items: readonly T[], size: number): T[][] {
	const width = Math.max(1, size);
	const out: T[][] = [];
	for (let i = 0; i < items.length; i += width) out.push(items.slice(i, i + width));
	return out;
}

export type LandApplyHooks = {
	shipWidth?: number;
	shouldStop?: () => boolean;
	onStep?: (event: LandStepEvent) => void;
	onIdle?: (siteId: string) => void;
	onShip?: (siteId: string, step: LandStep, ok: boolean, reason: string) => Promise<void>;
};

/**
 * One plugin apply per group. Sync, then push, then ship. A failed site is left out of later waves.
 * Stop before the next group. Sites the bridge never started are omitted when the run stopped.
 */
export async function applyLandPlans(
	plans: readonly LandPlan[],
	apply: (action: LandWave, ids: string[]) => Promise<unknown>,
	hooks: LandApplyHooks = {},
): Promise<{ results: LandApplyResult[]; stopped: boolean }> {
	const width = hooks.shipWidth ?? LAND_BATCH_WIDTH;
	const byId = new Map(plans.map((plan) => [plan.siteId, { siteId: plan.siteId, ok: true, steps: [] } as LandApplyResult]));
	const failed = new Set<string>();
	let stopped = false;
	for (const plan of plans) {
		if (!plan.steps.length) hooks.onIdle?.(plan.siteId);
	}

	for (const wave of LAND_WAVES) {
		const ready = plans.filter(
			(plan) => !failed.has(plan.siteId) && plan.steps.some((step) => step.pluginAction === wave),
		);
		for (const group of landChunks(ready, width)) {
			if (hooks.shouldStop?.()) {
				stopped = true;
				break;
			}
			for (const plan of group) {
				const index = plan.steps.findIndex((step) => step.pluginAction === wave);
				hooks.onStep?.({ id: plan.siteId, index, status: 'start' });
			}
			let report;
			try {
				report = landPluginApplyReport(await apply(wave, group.map((plan) => plan.siteId)));
			} catch (err) {
				const reason = err instanceof Error ? err.message : String(err);
				report = landPluginApplyReport({
					results: group.map((plan) => ({ id: plan.siteId, ok: false, detail: reason })),
				});
			}
			for (const plan of group) {
				const index = plan.steps.findIndex((step) => step.pluginAction === wave);
				const step = plan.steps[index];
				const row = report.sites.get(plan.siteId);
				if (!step || !row) continue;
				const out = byId.get(plan.siteId)!;
				out.steps.push({ ...step, ok: row.ok, reason: row.reason });
				hooks.onStep?.({
					id: plan.siteId,
					index,
					status: row.ok ? 'done' : 'fail',
					reason: row.ok ? undefined : row.reason,
				});
				if (!row.ok) {
					out.ok = false;
					out.stoppedAt = step.label;
					failed.add(plan.siteId);
				}
				if (wave === 'ship') await hooks.onShip?.(plan.siteId, step, row.ok, row.reason);
			}
			if (report.stopped || hooks.shouldStop?.()) {
				stopped = true;
				break;
			}
		}
		if (stopped) break;
	}

	const results: LandApplyResult[] = [];
	for (const plan of plans) {
		const out = byId.get(plan.siteId)!;
		if (!out.ok || plan.steps.length === 0 || out.steps.length >= plan.steps.length) {
			results.push(out);
			continue;
		}
		if (!stopped) {
			out.ok = false;
			out.stoppedAt = 'incomplete';
			results.push(out);
		}
	}
	return { results, stopped };
}

export async function applyLandBatch(
	loaded: LoadedManifest,
	plans: readonly LandPlan[],
	opts: {
		otp?: string;
		onStep?: (event: LandStepEvent) => void;
		onIdle?: (siteId: string) => void;
		shouldStop?: () => boolean;
	} = {},
): Promise<{ results: LandApplyResult[]; stopped: boolean }> {
	const plug = requirePlugin(await loadPlugins(loaded), LAND_PLUGIN_ID);
	return applyLandPlans(
			plans,
			async (action, ids) => {
				if (!plug.plugin.apply) throw new Error('plugin has no apply');
				return plug.plugin.apply(action, ids);
			},
			{
				shouldStop: opts.shouldStop,
				onStep: opts.onStep,
				onIdle: opts.onIdle,
				onShip: async (siteId, step, ok, reason) => {
					if (ok) {
						if (step.shipFingerprint) await recordLandShip(loaded.workspaceRoot, siteId, step.shipFingerprint);
						return;
					}
					await markLandShipFailed(loaded.workspaceRoot, siteId, step.shipFingerprint ?? '', reason);
				},
			},
		);
}

export async function applyLand(
	loaded: LoadedManifest,
	plan: LandPlan,
	opts: { otp?: string; onStep?: (event: LandStepEvent) => void } = {},
): Promise<LandApplyResult> {
	const batch = await applyLandBatch(loaded, [plan], opts);
	return batch.results[0] ?? { siteId: plan.siteId, ok: false, steps: [], stoppedAt: 'missing' };
}

/** Test helper: does this inventory row look like a Land publish need? */
export function landWouldPublish(row: ProjectStatus): boolean {
	return Boolean(row.unpublishedAhead && !whyNotPublish(row));
}
