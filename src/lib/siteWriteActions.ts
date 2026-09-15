/** Sites / Land / plugin start/apply pairs. Ports family jobs call startPluginJob. */

import { remainingAfter } from './batchApply.js';
import { bulkProgressLabel } from './bulkProgress.js';
import { applyConfirmStep } from './confirmProgress.js';
import type { DashboardJobHost } from './dashboardJob.js';
import {
	landApplyTitle,
	landConfirmItems,
	landResultHint,
	landResultLine,
	landResultPhase,
	landResultTitle,
	landRowFromApply,
	orderLandResults,
	type LandBatchRow,
} from './landDisplay.js';
import { isJobCancelled } from './jobCancel.js';
import { formatPluginPlanLines, pluginPlanLineKeys, pluginPlanWriteIds } from './pluginPlan.js';
import { landPluginApplyOk } from './writeGate.js';
import { planOpts, pluginJobHint } from './writeConfirm.js';

type LandPlanBody = {
	siteId: string;
	companionId: string | null;
	engineId: string;
	steps: { kind: string; label: string }[];
	needsPublish: boolean;
	needsOtp: boolean;
	note: string;
};

type LandPlanPayload = {
	plans?: LandPlanBody[];
	plan?: LandPlanBody;
	npmUser?: string | null;
	authHint?: string;
};

export function createSiteWrites(host: DashboardJobHost) {
	async function startPluginJob(plugin: string, action: string, ids: string[], label: string): Promise<void> {
		if (ids.length === 0) return;
		const unit = plugin === 'localslip' ? 'lease' : 'site';
		const scope = ids.length === 1 ? ids[0] : `${ids.length} ${unit}s`;
		await host.run(
			ids.length === 1 ? `planning ${action} ${ids[0]}` : `planning ${action} for ${ids.length} ${unit}s`,
			async () => {
				const data = await host.call('/api/plugin', {
					method: 'POST',
					body: JSON.stringify({ id: plugin, action, ids, apply: false }),
				});
				const writeIds = pluginPlanWriteIds(data);
				const applyIds = writeIds ?? [...ids];
				const items = formatPluginPlanLines(data);
				const lineKeys = pluginPlanLineKeys(data);
				host.note(`${plugin} ${action} plan ${scope}`, data);
				host.offerConfirm({
					title: applyIds.length
						? `${label} for ${applyIds.length === 1 ? applyIds[0] : `${applyIds.length} ${unit}s`}?`
						: `Nothing to ${label.toLowerCase()}`,
					hint: pluginJobHint(plugin, action, applyIds, writeIds, data),
					items: items.length ? items : ['Nothing to do.'],
					itemKeys:
						items.length && lineKeys.length === items.length
							? lineKeys
							: items.length === applyIds.length
								? applyIds
								: ids,
					applyIds,
					confirmLabel: applyIds.length === 1 ? label : `${label} ${applyIds.length}`,
					canApply: applyIds.length > 0,
					run: (included) => void applyPluginJob(plugin, action, applyIds.filter((id) => included.includes(id))),
				});
			},
			planOpts(label, ids),
		);
	}

	async function applyPluginItems(plugin: string, action: string, ids: string[]): Promise<void> {
		const verb = `${plugin} ${action}`;
		await host.eachNamed(verb, ids, async (id) => {
			const data = await host.call('/api/plugin', {
				method: 'POST',
				body: JSON.stringify({ id: plugin, action, ids: [id], apply: true }),
			});
			host.note(`${verb} --apply ${id}`, data);
			const check = landPluginApplyOk(data);
			if (!check.ok) {
				throw new Error(check.reason);
			}
		});
	}

	async function applyPluginJob(plugin: string, action: string, ids: string[]): Promise<void> {
		await host.run(bulkProgressLabel(`${plugin} ${action}`, 1, ids.length, ids[0]), async () => {
			try {
				await applyPluginItems(plugin, action, ids);
			} finally {
				await host.loadPluginBoards();
			}
		});
	}

	function persistLandBatch(
		ids: string[],
		rows: LandBatchRow[],
		opts?: { done?: boolean; error?: string },
	): void {
		host.persistLandSnap(ids, rows, opts);
	}

	function offerLandOutcome(
		rows: LandBatchRow[],
		opts?: { interrupted?: boolean; leftover?: string[]; error?: string },
	): void {
		const leftover = (opts?.leftover ?? []).filter((id) => !rows.some((row) => row.id === id));
		const ordered = orderLandResults(rows);
		const items = [
			...ordered.map(landResultLine),
			...leftover.map((id) => `${id}  not started`),
		];
		if (!items.length) {
			if (host.jobStopped()) return;
			host.setConfirmOpen(false);
			host.clearLandBatch();
			return;
		}
		host.offerConfirm({
			title: landResultTitle(ordered, { interrupted: opts?.interrupted, stopped: host.jobStopped() }),
			hint: [
				opts?.interrupted
					? 'The board reloaded. Finished sites are listed. Names that never ran are at the bottom.'
					: '',
				host.jobStopped() || opts?.error ? (opts?.error ?? host.error()) : '',
				landResultHint(ordered),
				leftover.length ? 'Land remaining continues those sites only.' : '',
			]
				.filter(Boolean)
				.join(' '),
			items,
			itemKeys: [...ordered.map((row) => row.id), ...leftover],
			itemPhases: [...ordered.map(landResultPhase), ...leftover.map(() => 'pending' as const)],
			confirmLabel: leftover.length
				? leftover.length === 1
					? `Land ${leftover[0]}`
					: `Land ${leftover.length} remaining`
				: 'OK',
			canApply: leftover.length > 0,
			applyIds: leftover,
			oncancel: () => host.clearLandBatch(),
			run: leftover.length
				? (included) => {
						host.clearLandBatch();
						void applyLand(included);
					}
				: undefined,
		});
	}

	async function startLand(siteIds: string[]): Promise<void> {
		const ids = [...new Set(siteIds.map((id) => id.trim()).filter(Boolean))];
		if (!ids.length) return;
		await host.run(
			ids.length === 1 ? `planning land ${ids[0]}` : `planning land for ${ids.length} sites`,
			async () => {
				const payload = (await host.call('/api/land', {
					method: 'POST',
					body: JSON.stringify({ apply: false, siteIds: ids }),
				})) as LandPlanPayload;
				host.setPublishAuthHint(payload.authHint ?? '');
				if (payload.npmUser) {
					host.setNpmUser(payload.npmUser);
					host.persistNpmUser(payload.npmUser);
				}
				const plans = payload.plans?.length ? payload.plans : payload.plan ? [payload.plan] : [];
				const lined = landConfirmItems(plans);
				const work = plans.filter((plan) => plan.steps.length > 0);
				const needsPublish = plans.some((plan) => plan.needsPublish);
				const needsOtp = plans.some((plan) => plan.needsOtp);
				const one = plans[0];
				host.note(
					ids.length === 1
						? `land plan ${ids[0]} — ${one?.steps.length ?? 0} step(s), nothing written`
						: `land plan ${ids.length} sites — ${work.length} with writes, nothing written`,
					{ plans },
				);
				const extra = ids.length === 1 ? '' : ` ${work.length} of ${ids.length} need a write.`;
				host.offerConfirm({
					title: work.length
						? work.length === 1
							? `Land ${work[0]?.siteId}?`
							: `Land ${work.length} sites?`
						: ids.length === 1
							? `Nothing to land for ${ids[0]}`
							: 'Nothing to land',
					hint: work.length
						? `${one?.note ?? ''}${extra}${needsOtp && host.publishAuthHint() ? ` ${host.publishAuthHint()}` : ''}`
						: one?.note ?? 'Already current.',
					items: lined.items.length ? lined.items : ['Already current.'],
					itemKeys: lined.keys,
					confirmLabel: work.length === 1 ? `Land ${work[0]?.siteId}` : work.length ? `Land ${work.length}` : 'Land',
					canApply: work.length > 0,
					showOtp: needsOtp,
					applyIds: work.map((plan) => plan.siteId),
					run: (included) => void applyLand(work.map((plan) => plan.siteId).filter((id) => included.includes(id))),
				});
			},
			planOpts('Land', ids),
		);
	}

	async function applyLand(siteIds: string[]): Promise<void> {
		const ids = [...new Set(siteIds.map((id) => id.trim()).filter(Boolean))];
		const rows: LandBatchRow[] = [];
		persistLandBatch(ids, [], { done: false });
		await host.run(
			bulkProgressLabel('landing', 1, ids.length, ids[0]),
			async () => {
				const otp = host.publishOtp().trim() ? host.publishOtp().trim() : undefined;
				try {
					await host.eachNamed('landing', ids, async (siteId) => {
						try {
							const data = (await host.callNdjson(
								'/api/land',
								{
									method: 'POST',
									body: JSON.stringify({ apply: true, siteId, otp }),
								},
								(event) => {
									if (event.type !== 'step') return;
									host.setConfirmPhases(
										applyConfirmStep(host.confirmItemKeys(), host.confirmPhases(), {
											id: String(event.id ?? siteId),
											index: Number(event.index),
											status: event.status === 'fail' || event.status === 'done' ? event.status : 'start',
										}),
									);
									if (event.status === 'fail' && event.reason) {
										host.setError(String(event.reason));
									}
								},
							)) as {
								result: {
									ok: boolean;
									stoppedAt?: string;
									steps: { ok: boolean; label: string; reason: string }[];
								};
							};
							const row = landRowFromApply(siteId, data.result);
							rows.push(row);
							const ok = data.result.steps.filter((s) => s.ok).length;
							const failed = data.result.steps.filter((s) => !s.ok);
							host.note(
								data.result.ok
									? `land --apply ${siteId} — ${ok} step(s) ok`
									: `land --apply ${siteId} — stopped: ${data.result.stoppedAt ?? failed[0]?.label ?? 'failed'}`,
								data,
							);
							if (!row.ok) host.setError(row.reason ?? 'land failed');
						} catch (err) {
							if (isJobCancelled(err)) throw err;
							const reason = err instanceof Error ? err.message : String(err);
							rows.push({ id: siteId, ok: false, reason });
							host.setError(reason);
							host.note(`land --apply ${siteId} — stopped: ${reason}`, { error: reason });
						}
						persistLandBatch(ids, rows, { error: host.error() || undefined });
					});
					host.note(landApplyTitle(rows), { rows });
				} finally {
					host.setPublishOtp('');
					await host.loadPluginBoards();
					await host.loadStatus({ ids });
				}
			},
			{ closeConfirm: false },
		);
		persistLandBatch(ids, rows, { done: !host.jobStopped(), error: host.error() || undefined });
		offerLandOutcome(rows, {
			leftover: remainingAfter(ids, rows),
			error: host.error() || undefined,
		});
	}

	return {
		startPluginJob,
		applyPluginItems,
		startLand,
		offerLandOutcome,
	};
}
