import { applyPull, applyPush, type GitJobRow } from './git.js';
import type { LoadedManifest } from './manifest.js';
import { loadPlugins, requirePlugin, type HelmPlugin } from './plugin.js';
import { applyPublish, planPublishFromInventory, type PublishRow } from './publish.js';
import { fleetStatus } from './status.js';
import type { FleetInventory, ProjectStatus } from './types.js';
import { commitCountLabel, plainGitError, whyNotPublish, whyNotPush } from './writeGate.js';
import { readLandShipFingerprint, recordLandShip, shipUnchanged } from './landShips.js';

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

function pullFromStatus(row: ProjectStatus): GitJobRow | null {
	const git = row.git;
	if (row.missing || !git.repo) return null;
	if (git.dirty) return null;
	if (git.busy) return null;
	if (!git.origin) return null;
	if (git.behind == null) return null;
	if (git.behind === 0) return null;
	if ((git.ahead ?? 0) > 0) return null;
	return {
		id: row.id,
		path: row.path,
		action: 'pull',
		origin: git.origin,
		branch: git.branch,
		ahead: git.ahead,
		remote: 'origin',
		reason: `${git.behind} behind`,
	};
}

function pushFromStatus(row: ProjectStatus): GitJobRow | null {
	const blocked = whyNotPush(row.git);
	if (blocked) return null;
	const dirt = row.git.dirty ? ' · uncommitted files stay local' : '';
	return {
		id: row.id,
		path: row.path,
		action: 'push',
		origin: row.git.origin,
		branch: row.git.branch,
		ahead: row.git.ahead,
		remote: 'origin',
		reason: `${commitCountLabel(row.git.ahead) || row.git.ahead} on ${row.git.branch} → ${row.git.origin}${dirt}`,
	};
}

function packageSteps(inventory: FleetInventory, id: string, role: LandRole): LandStep[] {
	const row = inventory.projects.find((p) => p.id === id);
	if (!row) return [];

	const steps: LandStep[] = [];
	const pull = pullFromStatus(row);
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
		const pub = planPublishFromInventory(inventory, [id], 'patch')[0];
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

	const push = pushFromStatus(row);
	if (push) {
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

type LandPluginRow = {
	id?: string;
	sync?: { writes?: boolean };
	push?: { writes?: boolean; reason?: string; action?: string };
	ship?: { writes?: boolean; fingerprint?: string | null; script?: string | null };
};

async function siteSteps(
	plugin: HelmPlugin,
	workspaceRoot: string,
	siteId: string,
): Promise<LandStep[]> {
	if (!plugin.plan) return [];
	const planned = await plugin.plan('land', [siteId]);
	const rows = planned && typeof planned === 'object' ? (planned as { rows?: LandPluginRow[] }).rows : null;
	const row = Array.isArray(rows) ? rows.find((r) => r.id === siteId) ?? rows[0] : null;
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
		const last = await readLandShipFingerprint(workspaceRoot, siteId);
		if (shipUnchanged(last, fingerprint)) {
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
	const enrolledAll = loaded.manifest.projects.map((p) => p.id);
	const companionId = companionIdForSite(siteId, enrolledAll, LAND_ENGINE_ID);
	const packageIds = [LAND_ENGINE_ID, companionId].filter(
		(id): id is string => typeof id === 'string' && enrolledAll.includes(id),
	);
	const uniqueIds = [...new Set(packageIds)];

	const [inventory, plug] = await Promise.all([
		uniqueIds.length
			? fleetStatus(loaded, { onlyIds: uniqueIds })
			: Promise.resolve({
					workspaceRoot: loaded.workspaceRoot,
					manifestPath: loaded.manifestPath,
					digest: {
						projects: 0,
						dirty: 0,
						unpublishedAhead: 0,
						cascadeBehind: 0,
						missing: 0,
						npmErrors: 0,
					},
					projects: [] as ProjectStatus[],
				} satisfies FleetInventory),
		loadPlugins(loaded).then((plugins) => requirePlugin(plugins, LAND_PLUGIN_ID)),
	]);

	const steps: LandStep[] = [];
	if (uniqueIds.includes(LAND_ENGINE_ID)) {
		steps.push(...packageSteps(inventory, LAND_ENGINE_ID, 'engine'));
	}
	if (companionId && uniqueIds.includes(companionId)) {
		steps.push(...packageSteps(inventory, companionId, 'companion'));
	}
	steps.push(...(await siteSteps(plug.plugin, loaded.workspaceRoot, siteId)));

	const needsPublish = steps.some((s) => s.kind === 'publish');
	const note = steps.length
		? 'Does the writes that are already needed, in order. Engine package, matching fleet package, then this site. Ship is skipped when the tree matches the last successful ship.'
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
			out.steps.push({
				...step,
				ok,
				reason: ok ? next.reason! : plainGitError(next.reason ?? next.stderr ?? 'pull failed'),
			});
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
			if (step.pluginAction === 'ship' && step.shipFingerprint) {
				await recordLandShip(loaded.workspaceRoot, plan.siteId, step.shipFingerprint);
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
