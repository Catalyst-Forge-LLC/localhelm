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
import { featureReviewConfirm, featurefactsCheckLines } from './featureReview.js';
import { formatPluginPlanLines, pluginPlanLineKeys, pluginPlanWriteIds } from './pluginPlan.js';
import { landPluginApplyOk } from './writeGate.js';
import { checkResultFollowUp, checkResultLines, planOpts, pluginJobHint } from './writeConfirm.js';

function featurefactsApplyDetail(data: unknown, id: string): { ok: boolean; detail: string } {
	const results =
		data && typeof data === 'object' && Array.isArray((data as { results?: unknown }).results)
			? (data as { results: { id?: string; ok?: boolean; detail?: string }[] }).results
			: [];
	const row = results.find((item) => item.id === id) ?? results[0];
	const detail = typeof row?.detail === 'string' && row.detail.trim() ? row.detail.trim() : 'checked';
	return { ok: row?.ok !== false && (data as { ok?: boolean })?.ok !== false, detail };
}

function pluginApplyDetail(data: unknown, id: string): { ok: boolean; detail: string } {
	const rows =
		data && typeof data === 'object' && Array.isArray((data as { rows?: unknown }).rows)
			? (data as { rows: { id?: string; ok?: boolean; detail?: string }[] }).rows
			: [];
	const row = rows.find((item) => item.id === id) ?? rows[0];
	const detail = typeof row?.detail === 'string' && row.detail.trim() ? row.detail.trim() : 'checked';
	return { ok: row?.ok !== false, detail };
}

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
				if (plugin === 'featurefacts' && action === 'view') {
					const body = data && typeof data === 'object' ? (data as { hasLabel?: unknown; text?: unknown }) : {};
					const hasLabel = body.hasLabel === true;
					const text = typeof body.text === 'string' && body.text.trim() ? body.text : 'No label yet.';
					host.note(`${plugin} view ${scope}`, data);
					host.offerConfirm({
						title: hasLabel ? `Label for ${ids[0]}` : `No label for ${ids[0]}`,
						hint: hasLabel
							? 'This is FEATURE_FACTS.md. Nothing is written.'
							: 'Review ticks which capabilities go on the label.',
						items: [text],
						confirmLabel: 'Close',
						canApply: false,
					});
					return;
				}
				if (plugin === 'featurefacts' && action === 'review') {
					const spec = featureReviewConfirm(ids[0] ?? 'repo', data);
					host.note(`${plugin} review plan ${scope}`, data);
					host.offerConfirm({
						title: spec.title,
						hint: spec.hint,
						items: spec.items,
						itemKeys: spec.itemKeys,
						itemLabels: spec.itemLabels,
						excludedIds: spec.excludedIds,
						applyIds: spec.applyIds,
						confirmLabel: spec.confirmLabel,
						canApply: spec.canApply,
						run: (included) => void applyFeatureReview(ids[0] ?? '', included),
					});
					return;
				}
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
			planOpts(label, ids, pluginJobHint(plugin, action, ids, null)),
		);
	}

	async function applyFeatureReview(repoId: string, featureIds: string[]): Promise<void> {
		if (!repoId) return;
		await host.run(`updating the label for ${repoId}`, async () => {
			if (featureIds.length > 12) {
				throw new Error('A label holds at most 12 capabilities. Untick down to 12.');
			}
			const data = await host.call('/api/plugin', {
				method: 'POST',
				body: JSON.stringify({ id: 'featurefacts', action: 'review', ids: [repoId, ...featureIds], apply: true }),
			});
			host.note(`featurefacts review --apply ${repoId}`, data);
			const check = landPluginApplyOk(data);
			if (!check.ok) throw new Error(check.reason);
		});
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

	function boardRefreshLabel(plugin: string): string {
		if (plugin === 'filepress') return 'reading sites';
		if (plugin === 'localslip') return 'reading ports';
		return `reading ${plugin}`;
	}

	async function applyPluginJob(plugin: string, action: string, ids: string[]): Promise<void> {
		if (plugin === 'xfacts' && action === 'check') {
			await applyXfactsCheck(ids);
			return;
		}
		if (plugin === 'featurefacts' && action === 'check') {
			await applyFeaturefactsCheck(ids);
			return;
		}
		await host.run(bulkProgressLabel(`${plugin} ${action}`, 1, ids.length, ids[0]), async () => {
			try {
				await applyPluginItems(plugin, action, ids);
			} finally {
				host.setBusy(boardRefreshLabel(plugin));
				await host.loadPluginBoards(plugin);
			}
		});
	}

	async function applyFeaturefactsCheck(ids: string[]): Promise<void> {
		const results: { id: string; ok: boolean; detail: string }[] = [];
		await host.run(
			bulkProgressLabel('featurefacts check', 1, ids.length, ids[0]),
			async () => {
				for (const id of ids) {
					const data = await host.call('/api/plugin', {
						method: 'POST',
						body: JSON.stringify({ id: 'featurefacts', action: 'check', ids: [id], apply: true }),
					});
					host.note(`featurefacts check ${id}`, data);
					results.push({ id, ...featurefactsApplyDetail(data, id) });
				}
				host.setError('');
				offerFeaturefactsCheck(results);
			},
			{ closeConfirm: false },
		);
	}

	function offerFeaturefactsCheck(results: { id: string; ok: boolean; detail: string }[]): void {
		const failed = results.filter((row) => !row.ok);
		const items: string[] = [];
		const itemKeys: string[] = [];
		const itemPhases: Array<'done' | 'fail'> = [];
		for (const row of results) {
			const lines = featurefactsCheckLines(row.detail);
			lines.forEach((line, index) => {
				items.push(results.length > 1 ? `${row.id}  ${line}` : line);
				itemKeys.push(`${row.id}:${index}`);
				itemPhases.push(row.ok ? 'done' : 'fail');
			});
		}
		const who = failed.length === 1 ? failed[0]?.id : `${failed.length} repos`;
		host.offerConfirm({
			title: failed.length ? `Check found problems for ${who}` : `Check passed`,
			hint: 'Nothing was written. Scan refreshes the candidate list. Review writes the label.',
			items,
			itemKeys,
			itemPhases,
			applyIds: [],
			confirmLabel: 'Close',
			canApply: false,
		});
	}

	async function applyXfactsCheck(ids: string[]): Promise<void> {
		const results: { id: string; ok: boolean; detail: string }[] = [];
		await host.run(
			bulkProgressLabel('xfacts check', 1, ids.length, ids[0]),
			async () => {
				await host.eachNamed('xfacts check', ids, async (id) => {
					const data = await host.call('/api/plugin', {
						method: 'POST',
						body: JSON.stringify({ id: 'xfacts', action: 'check', ids: [id], apply: true }),
					});
					host.note(`xfacts check --apply ${id}`, data);
					const row = pluginApplyDetail(data, id);
					results.push({ id, ok: row.ok, detail: row.detail });
					if (!row.ok) throw new Error(row.detail);
				});
				host.setError('');
				offerXfactsCheckResults(results);
			},
			{ closeConfirm: false },
		);
	}

	function offerXfactsCheckResults(results: { id: string; ok: boolean; detail: string }[]): void {
		const failed = results.filter((row) => !row.ok);
		const addIds = failed.filter((row) => checkResultFollowUp(row.detail).add).map((row) => row.id);
		const updateIds = failed.filter((row) => checkResultFollowUp(row.detail).update).map((row) => row.id);
		const both = addIds.length > 0 && updateIds.length > 0;
		const primary = addIds.length ? addIds : updateIds;
		const pool = [...new Set([...addIds, ...updateIds])];
		const primaryAction = addIds.length ? 'refresh' : 'update';
		const primaryLabel = addIds.length
			? addIds.length === 1
				? `Add labels ${addIds[0]}`
				: `Add labels ${addIds.length}`
			: updateIds.length === 1
				? `Update ${updateIds[0]}`
				: `Update ${updateIds.length}`;
		const okCount = results.length - failed.length;
		const items: string[] = [];
		const itemKeys: string[] = [];
		const itemPhases: Array<'done' | 'fail'> = [];
		for (const row of results) {
			const lines = row.ok ? ['Passed'] : checkResultLines(row.detail);
			lines.forEach((line, index) => {
				items.push(`${row.id}  ${line}`);
				itemKeys.push(`${row.id}:${index}`);
				itemPhases.push(row.ok ? 'done' : 'fail');
			});
		}
		host.offerConfirm({
			title: failed.length
				? `${failed.length} of ${results.length} need a label`
				: `Checked ${results.length}`,
			hint: failed.length
				? 'Each line is one finding. Add labels fills missing files and leaves an existing label. Update rewrites a stale AppFacts file from the repo scan, without a model. Both commit only the label files they wrote. Neither pushes.'
				: `${okCount} passed.`,
			items,
			itemKeys,
			itemPhases,
			applyIds: pool,
			confirmLabel: primaryLabel,
			canApply: primary.length > 0,
			altLabel: both ? (updateIds.length === 1 ? `Update ${updateIds[0]}` : `Update ${updateIds.length}`) : '',
			run: primary.length
				? (included) => {
						const ids = included.filter((id) => primary.includes(id));
						if (ids.length) void applyPluginJob('xfacts', primaryAction, ids);
					}
				: undefined,
			alt: both
				? (included) => {
						const ids = included.filter((id) => updateIds.includes(id));
						if (ids.length) void applyPluginJob('xfacts', 'update', ids);
					}
				: undefined,
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
					host.setBusy(boardRefreshLabel('filepress'));
					await host.loadPluginBoards('filepress');
					await host.reloadAfterWrite(ids, 'git');
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
