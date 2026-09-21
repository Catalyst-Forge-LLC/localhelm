/** Fleet start/apply pairs. ConfirmModal and loadStatus stay on the page host. */

import { remainingAfter } from './batchApply.js';
import { bulkProgressLabel } from './bulkProgress.js';
import { applyConfirmStep, commitDraftProgressHint, markConfirmKey } from './confirmProgress.js';
import type { DashboardJobHost } from './dashboardJob.js';
import type { BumpKind, BumpPlan, GitRow, GlobalInstallRow, PublishRow, ScriptShipRow } from './dashboardTypes.js';
import { formatPluginPlanLines } from './pluginPlan.js';
import { publishNeedsGithub, publishNeedsNpm } from './publishDisplay.js';
import {
	canSkipPublishResultsForGlobalInstall,
	globalInstallLine,
	isGithubPublishReason,
	isNpmNotReadyReason,
	isPublishedReason,
	npmNotReadyHint,
	npmNotReadyTitle,
	orderPublishResults,
	publishApplyTitle,
	publishResultHint,
	publishResultLine,
	publishResultPhase,
	publishResultTitle,
} from './writeGate.js';
import {
	type CommitPlanRow,
	type PublishBatchRow,
	dirtPlanLine,
	githubPendingRows,
	globalItems,
	planOpts,
	publishItemKeys,
	publishItems,
	pushItems,
	shipItems,
	slimPublishRows,
} from './writeConfirm.js';

export function createFleetWrites(host: DashboardJobHost) {
	async function startBump(ids: string[]): Promise<void> {
		ids = host.readyNamed(ids);
		if (ids.length === 0) {
			host.setError('Check at least one fleet row first.');
			return;
		}
		const kinds = host.bumpKind();
		const jobs = ids.map((id) => ({ id, kind: (kinds[id] ?? 'patch') as BumpKind }));
		const scope = jobs.length === 1 ? jobs[0]?.id : `${jobs.length} projects`;
		await host.run(
			`planning bump for ${scope}`,
			async () => {
				const plans: BumpPlan[] = [];
				for (let i = 0; i < jobs.length; i++) {
					const job = jobs[i];
					if (!job) continue;
					host.setBusy(bulkProgressLabel('planning bump', i + 1, jobs.length, job.id));
					if (host.confirmItemKeys().includes(job.id)) {
						host.setConfirmPhases(markConfirmKey(host.confirmItemKeys(), host.confirmPhases(), job.id, 'current'));
					}
					const plan = (await host.call('/api/bump', {
						method: 'POST',
						body: JSON.stringify({ id: job.id, kind: job.kind, apply: false }),
					})) as BumpPlan;
					plans.push(plan);
					if (host.confirmItemKeys().includes(job.id)) {
						host.setConfirmPhases(markConfirmKey(host.confirmItemKeys(), host.confirmPhases(), job.id, 'done'));
					}
					host.note(
						plan.action === 'bump'
							? `bump plan ${job.id} ${plan.from} → ${plan.to}, nothing written`
							: `bump plan ${job.id} — skipped`,
						plan,
					);
				}
				const can = plans.filter((plan) => plan.action === 'bump' && Boolean(plan.to));
				host.offerConfirm({
					title: can.length === 1
						? `Bump ${can[0]?.id} to ${can[0]?.to}?`
						: can.length
							? `Bump ${can.length} projects?`
							: 'Nothing to bump',
					hint: can.length
						? 'Writes package.json and commits that file. Other dirty files stay local. No tag, no push, no publish. Each row uses its own patch/minor/major.'
						: plans[0]?.reason ?? 'cannot bump',
					items: plans.map((plan) =>
						plan.action === 'bump' && plan.to
							? plan.commit === 'commit'
								? `${plan.id}  ${plan.from ?? '?'} → ${plan.to}\n${plan.commitMessage}`
								: `${plan.id}  ${plan.from ?? '?'} → ${plan.to}\nno commit — ${plan.commitReason ?? 'skipped'}`
							: `${plan.id}  ${plan.reason ?? 'skipped'}`,
					),
					itemKeys: plans.map((plan) => plan.id),
					applyIds: can.map((plan) => plan.id),
					confirmLabel: can.length === 1 ? `Bump and commit ${can[0]?.to}` : `Bump and commit ${can.length}`,
					canApply: can.length > 0,
					run: (included) =>
						void applyBumps(
							can
								.filter((plan) => included.includes(plan.id))
								.map((plan) => ({
									id: plan.id,
									kind: jobs.find((job) => job.id === plan.id)?.kind ?? 'patch',
								})),
						),
				});
			},
			planOpts('Bump', ids),
		);
	}

	async function suggestCommitDrafts(ids: string[]): Promise<void> {
		host.setConfirmDraftIds(ids);
		host.setConfirmDrafting([...ids]);
		host.setConfirmDraftNotes({});
		host.setConfirmDraftHint(commitDraftProgressHint({ ids, pending: host.confirmDrafting() }));
		for (const id of ids) {
			if (!host.confirmOpen()) break;
			if (host.confirmMessageTouched()[id] || host.confirmExcluded().includes(id)) {
				host.setConfirmDrafting(host.confirmDrafting().filter((item) => item !== id));
				host.setConfirmDraftHint(
					commitDraftProgressHint({
						ids: host.confirmDraftIds(),
						pending: host.confirmDrafting(),
						notes: host.confirmDraftNotes(),
					}),
				);
				continue;
			}
			host.setConfirmDraftHint(
				commitDraftProgressHint({
					ids: host.confirmDraftIds(),
					pending: host.confirmDrafting(),
					selected: id,
					notes: host.confirmDraftNotes(),
				}),
			);
			try {
				const data = (await host.call('/api/commit', {
					method: 'POST',
					body: JSON.stringify({ ids: [id], apply: false, suggest: true }),
				})) as { rows: CommitPlanRow[] };
				const row = data.rows[0];
				if (!row || !host.confirmOpen()) continue;
				const text = row.message?.trim();
				if (!host.confirmMessageTouched()[id] && text) {
					host.setConfirmMessages({ ...host.confirmMessages(), [id]: text });
				}
				const draftNote =
					row.suggestSource === 'ollama' && row.suggestModel
						? `Ollama (${row.suggestModel}${row.suggestHost ? ` on ${row.suggestHost}` : ''}) drafted this. Edit if you want.`
						: row.suggestNote ?? 'Edit the message, then confirm.';
				host.setConfirmDraftNotes({ ...host.confirmDraftNotes(), [id]: draftNote });
			} catch (err) {
				host.setConfirmDraftNotes({
					...host.confirmDraftNotes(),
					[id]: err instanceof Error ? err.message : String(err),
				});
			}
			host.setConfirmDrafting(host.confirmDrafting().filter((item) => item !== id));
			host.setConfirmDraftHint(
				commitDraftProgressHint({
					ids: host.confirmDraftIds(),
					pending: host.confirmDrafting(),
					notes: host.confirmDraftNotes(),
				}),
			);
		}
	}

	function markCommitKeys(id: string, phase: 'current' | 'done' | 'fail') {
		let next = host.confirmPhases();
		for (const key of host.confirmItemKeys()) {
			if (key === id || key.startsWith(`${id}:`)) next = markConfirmKey(host.confirmItemKeys(), next, key, phase);
		}
		return next;
	}

	async function startCommit(ids: string[]): Promise<void> {
		ids = host.readyNamed(ids);
		if (ids.length === 0) {
			host.setError('Check at least one dirty fleet row first.');
			return;
		}
		const label = ids.length === 1 ? ids[0] : `${ids.length} repos`;
		await host.run(
			`planning commit ${label}`,
			async () => {
				const data = (await host.call('/api/commit', {
					method: 'POST',
					body: JSON.stringify({ ids, apply: false, suggest: false }),
				})) as { rows: CommitPlanRow[] };
				const can = data.rows.filter((row) => row.action === 'commit');
				const items: string[] = [];
				const itemKeys: string[] = [];
				const named = data.rows.length > 1;
				for (const row of data.rows) {
					if (row.action !== 'commit') {
						items.push(`${row.id}  skip — ${row.reason ?? 'skipped'}`);
						itemKeys.push(row.id);
						continue;
					}
					const files = row.files.length ? row.files : [{ path: '(no files)', code: '  ' }];
					for (const [i, file] of files.entries()) {
						const line = dirtPlanLine(file);
						items.push(named ? `${row.id}  ${line}` : line);
						itemKeys.push(`${row.id}:${i}`);
					}
				}
				host.note(`commit plan — ${can.length} of ${data.rows.length} dirty, nothing written`, data);
				host.offerConfirm({
					title: can.length === 1 ? `Commit ${can[0]?.id}?` : can.length ? `Commit ${can.length} repos?` : 'Nothing to commit',
					hint: can.length
						? 'Fallback messages are ready to edit. ollanet drafts on a network Ollama host when one is up (this machine is last). Confirm runs git add and git commit. Secrets stay out. No push.'
						: data.rows[0]?.reason ?? 'Nothing dirty to commit.',
					items,
					itemKeys,
					messages: Object.fromEntries(can.map((row) => [row.id, row.message])),
					diffs: Object.fromEntries(
						data.rows.flatMap((row) =>
							row.files.map((file, i) => [`${row.id}:${i}`, row.diffs?.[file.path] ?? ''] as const),
						).filter(([, text]) => text),
					),
					draftHint: can.length ? commitDraftProgressHint({ ids: can.map((row) => row.id), pending: can.map((row) => row.id) }) : '',
					confirmLabel: can.length === 1 ? `Commit ${can[0]?.id}` : `Commit ${can.length}`,
					canApply: can.length > 0,
					applyIds: can.map((row) => row.id),
					run: (included) => void applyCommits(can.map((row) => row.id).filter((id) => included.includes(id))),
				});
				if (can.length) void suggestCommitDrafts(can.map((row) => row.id));
			},
			planOpts('Commit', ids),
		);
	}

	async function applyCommits(ids: string[]): Promise<void> {
		const named = ids.filter(Boolean);
		if (!named.length) return;
		host.setConfirmDrafting([]);
		await host.run(bulkProgressLabel('committing', 1, named.length, named[0]), async () => {
			await host.eachNamed('committing', named, async (id) => {
				host.setConfirmPhases(markCommitKeys(id, 'current'));
				const data = (await host.call('/api/commit', {
					method: 'POST',
					body: JSON.stringify({
						ids: [id],
						apply: true,
						messages: { [id]: host.confirmMessages()[id] ?? '' },
					}),
				})) as { rows: CommitPlanRow[] };
				const row = data.rows[0];
				if (row?.action !== 'commit' || row.reason) {
					throw new Error(row?.reason ?? `commit ${id} failed`);
				}
				host.note(`commit --apply ${id}`, row);
				host.setConfirmPhases(markCommitKeys(id, 'done'));
				host.patchWrite({ id, gitDirty: false });
			});
			await host.reloadAfterWrite(named, 'git');
		});
	}

	async function applyBumps(jobs: { id: string; kind: BumpKind }[]): Promise<void> {
		const kinds = new Map(jobs.map((job) => [job.id, job.kind]));
		await host.run(bulkProgressLabel('bumping', 1, jobs.length, jobs[0]?.id), async () => {
			await host.eachNamed(
				'bumping',
				jobs.map((job) => job.id),
				async (id) => {
					const plan = (await host.call('/api/bump', {
						method: 'POST',
						body: JSON.stringify({ id, kind: kinds.get(id) ?? 'patch', apply: true }),
					})) as BumpPlan;
					host.note(
						plan.commit === 'commit'
							? `bumped ${id} to ${plan.to} and committed`
							: `bumped ${id} to ${plan.to}${plan.commitReason ? ` (no commit — ${plan.commitReason})` : ''}`,
						plan,
					);
					if (plan.action === 'bump' && plan.to) {
						host.patchWrite({
							id,
							localVersion: plan.to,
							gitDirty: plan.commit !== 'commit',
						});
					}
				},
			);
			await host.reloadAfterWrite(jobs.map((job) => job.id), 'git');
		});
	}

	async function startPull(): Promise<void> {
		await host.run(
			'planning pull',
			async () => {
				const data = (await host.call('/api/pull', { method: 'POST', body: JSON.stringify({ apply: false }) })) as {
					rows: GitRow[];
				};
				const eligible = data.rows.filter((r) => r.action === 'pull');
				host.note(`pull plan — ${eligible.length} of ${data.rows.length} eligible, nothing written`, data);
				host.offerConfirm({
					title: eligible.length ? `Pull ${eligible.length} repo${eligible.length === 1 ? '' : 's'}?` : 'Nothing to pull',
					hint: eligible.length
						? 'git pull --ff-only on the listed repos. Dirty or diverged trees are skipped.'
						: 'Nothing is eligible: repos must be clean and behind.',
					items: eligible.length ? eligible.map((row) => `${row.id}  ${row.branch ?? '?'}  ${row.reason ?? 'pull'}`) : ['Nothing to pull.'],
					itemKeys: eligible.map((row) => row.id),
					confirmLabel: eligible.length === 1 ? `Pull ${eligible[0]?.id}` : `Pull ${eligible.length} repos`,
					canApply: eligible.length > 0,
					applyIds: eligible.map((row) => row.id),
					run: (included) => void applyPull(eligible.map((row) => row.id).filter((id) => included.includes(id))),
				});
			},
			planOpts('Pull'),
		);
	}

	async function applyPull(ids: string[]): Promise<void> {
		await host.run(bulkProgressLabel('pulling', 1, ids.length, ids[0]), async () => {
			const rows: GitRow[] = [];
			await host.eachNamed('pulling', ids, async (id) => {
				const data = (await host.call('/api/pull', {
					method: 'POST',
					body: JSON.stringify({ apply: true, ids: [id] }),
				})) as { rows: GitRow[] };
				rows.push(...data.rows);
				if (data.rows.some((row) => row.reason === 'pulled ff-only')) {
					host.patchWrite({ id, gitBehind: 0 });
				}
			});
			const eligible = rows.filter((r) => r.action === 'pull');
			host.note(`pull --apply — ${eligible.length} repo(s) fast-forwarded`, { rows });
			await host.reloadAfterWrite(ids, 'git');
		});
	}

	async function startPush(onlyIds?: string[]): Promise<void> {
		if (onlyIds) {
			onlyIds = host.readyNamed(onlyIds);
			if (!onlyIds.length) return;
		}
		const scope = onlyIds?.length === 1 ? onlyIds[0] : onlyIds?.length ? `${onlyIds.length} repos` : 'all';
		await host.run(
			`planning push ${scope}`,
			async () => {
				const data = (await host.call('/api/push', {
					method: 'POST',
					body: JSON.stringify({ apply: false, ids: onlyIds }),
				})) as { rows: GitRow[] };
				const eligible = data.rows.filter((r) => r.action === 'push');
				const named = Boolean(onlyIds?.length);
				const listed = named ? data.rows : eligible;
				host.note(`push plan — ${eligible.length} of ${data.rows.length} eligible (origin only), nothing written`, data);
				const skipNote =
					named && listed.length > eligible.length
						? `${eligible.length} of ${listed.length} checked can push. Click a name to see why the others stay local. `
						: '';
				host.offerConfirm({
					title: eligible.length === 1 ? `Push ${eligible[0]?.id} to origin?` : eligible.length ? 'Push these branches to origin?' : 'Nothing to push',
					hint: eligible.length
						? `${skipNote}git push origin only. Never --force. Never the IngotVault backup remote. Uncommitted files stay in the working tree.`
						: onlyIds?.length === 1
							? `${onlyIds[0]}: ${data.rows[0]?.reason ?? 'cannot push'}`
							: named
								? 'None of the checked repos can push: they must be ahead of origin and not diverged.'
								: 'Nothing is eligible: repos must be ahead of origin and not diverged.',
					items: listed.length ? pushItems(listed) : ['Nothing to push.'],
					itemKeys: listed.map((row) => row.id),
					confirmLabel: eligible.length === 1 ? `Push ${eligible[0]?.id}` : `Push ${eligible.length} to origin`,
					canApply: eligible.length > 0,
					applyIds: eligible.map((row) => row.id),
					run: (included) => void applyPush(eligible.map((row) => row.id).filter((id) => included.includes(id))),
				});
			},
			planOpts('Push', onlyIds),
		);
	}

	async function applyPush(ids: string[]): Promise<void> {
		await host.run(bulkProgressLabel('pushing', 1, ids.length, ids[0]), async () => {
			const rows: GitRow[] = [];
			await host.eachNamed('pushing', ids, async (id) => {
				const data = (await host.call('/api/push', {
					method: 'POST',
					body: JSON.stringify({ apply: true, ids: [id] }),
				})) as { rows: GitRow[] };
				rows.push(...data.rows);
				if (data.rows.some((row) => row.action === 'push' && row.reason === 'pushed')) {
					host.patchWrite({ id, gitAhead: 0 });
				}
			});
			const eligible = rows.filter((r) => r.action === 'push');
			const failed = eligible.filter((r) => r.reason !== 'pushed');
			const ok = eligible.length - failed.length;
			host.note(
				failed.length
					? `push --apply — ${ok} pushed, ${failed.length} failed: ${failed.map((r) => `${r.id}: ${r.reason ?? 'push failed'}`).join(' · ')}`
					: `push --apply — ${ok} pushed`,
				{ rows },
			);
			await host.reloadAfterWrite(ids, 'git');
			if (failed.length) {
				host.setError(failed.map((r) => `${r.id}: ${r.reason ?? 'push failed'}`).join(' · '));
			}
		});
	}

	async function startShip(onlyIds?: string[]): Promise<void> {
		if (onlyIds) {
			onlyIds = host.readyNamed(onlyIds);
			if (!onlyIds.length) return;
		}
		const scope = onlyIds?.length === 1 ? onlyIds[0] : onlyIds?.length ? `${onlyIds.length} repos` : 'all';
		await host.run(
			`planning ship ${scope}`,
			async () => {
				const data = (await host.call('/api/ship', {
					method: 'POST',
					body: JSON.stringify({ apply: false, ids: onlyIds }),
				})) as { rows: ScriptShipRow[] };
				const eligible = data.rows.filter((r) => r.action === 'ship');
				const named = Boolean(onlyIds?.length);
				const listed = named ? data.rows : eligible;
				host.note(`ship plan — ${eligible.length} of ${data.rows.length} have scripts.ship, nothing written`, data);
				const skipNote =
					named && listed.length > eligible.length
						? `${eligible.length} of ${listed.length} checked have a ship script. `
						: '';
				host.offerConfirm({
					title: eligible.length === 1 ? `Ship ${eligible[0]?.id}?` : eligible.length ? 'Ship these projects?' : 'Nothing to ship',
					hint: eligible.length
						? `${skipNote}Runs pnpm ship in each checkout (wrangler / Pages). Not FilePress Land. Confirm to deploy. Never --force.`
						: onlyIds?.length === 1
							? `${onlyIds[0]}: ${data.rows[0]?.reason ?? 'no scripts.ship'}`
							: named
								? 'None of the checked repos have a ship script in package.json (root or site/).'
								: 'Nothing enrolled has scripts.ship.',
					items: listed.length ? shipItems(listed) : ['Nothing to ship.'],
					itemKeys: listed.map((row) => row.id),
					confirmLabel: eligible.length === 1 ? `Ship ${eligible[0]?.id}` : `Ship ${eligible.length}`,
					canApply: eligible.length > 0,
					applyIds: eligible.map((row) => row.id),
					run: (included) => void applyShip(eligible.map((row) => row.id).filter((id) => included.includes(id))),
				});
			},
			planOpts('Ship', onlyIds),
		);
	}

	async function applyShip(ids: string[]): Promise<void> {
		await host.run(bulkProgressLabel('shipping', 1, ids.length, ids[0]), async () => {
			const rows: ScriptShipRow[] = [];
			await host.eachNamed('shipping', ids, async (id) => {
				const data = (await host.call('/api/ship', {
					method: 'POST',
					body: JSON.stringify({ apply: true, ids: [id] }),
				})) as { rows: ScriptShipRow[] };
				rows.push(...data.rows);
			});
			const eligible = rows.filter((r) => r.action === 'ship');
			const failed = eligible.filter((r) => !r.reason?.startsWith('shipped '));
			const ok = eligible.length - failed.length;
			host.note(
				failed.length
					? `ship --apply — ${ok} shipped, ${failed.length} failed: ${failed.map((r) => `${r.id}: ${r.reason ?? 'ship failed'}`).join(' · ')}`
					: `ship --apply — ${ok} shipped`,
				{ rows },
			);
			await host.reloadAfterWrite(ids, 'git');
			if (failed.length) {
				host.setError(failed.map((r) => `${r.id}: ${r.reason ?? 'ship failed'}`).join(' · '));
			}
		});
	}

	function offerNpmWait(rows: GlobalInstallRow[], versions?: Record<string, string>): void {
		const ids = rows.map((row) => row.id);
		host.offerConfirm({
			title: npmNotReadyTitle(rows),
			hint: npmNotReadyHint(),
			items: globalItems(rows),
			itemKeys: ids,
			confirmLabel: 'Wait',
			altLabel: 'Try again',
			canApply: true,
			applyIds: ids,
			run: (included) => void applyGlobal(included, versions, { wait: true }),
			alt: (included) => void applyGlobal(included, versions),
		});
	}

	async function startGlobal(onlyIds?: string[], versions?: Record<string, string>): Promise<void> {
		if (onlyIds) {
			onlyIds = host.readyNamed(onlyIds);
			if (!onlyIds.length) return;
		}
		const scope = onlyIds?.length === 1 ? onlyIds[0] : onlyIds?.length ? `${onlyIds.length} repos` : 'all';
		await host.run(
			`planning global ${scope}`,
			async () => {
				const data = (await host.call('/api/global', {
					method: 'POST',
					body: JSON.stringify({ apply: false, ids: onlyIds, versions }),
				})) as { rows: GlobalInstallRow[] };
				const eligible = data.rows.filter((r) => r.action === 'global');
				const named = Boolean(onlyIds?.length);
				const listed = named ? data.rows : eligible;
				host.note(`global plan — ${eligible.length} of ${data.rows.length} need a global CLI, nothing written`, data);
				const skipNote =
					named && listed.length > eligible.length
						? `${eligible.length} of ${listed.length} checked are missing or behind. `
						: '';
				host.offerConfirm({
					title:
						eligible.length === 1
							? `${eligible[0]?.have ? 'Update' : 'Install'} ${eligible[0]?.npm ?? eligible[0]?.id}@${eligible[0]?.version} globally?`
							: eligible.length
								? `Install ${eligible.length} CLIs globally?`
								: 'Nothing to install globally',
					hint: eligible.length
						? `${skipNote}Confirm checks npm for that version, then runs pnpm add -g (npm if pnpm is missing). A new publish can take a minute to show up. Never --force.`
						: onlyIds?.length === 1
							? `${onlyIds[0]}: ${data.rows[0]?.reason ?? 'no CLI to install'}`
							: named
								? 'None of the checked repos have a CLI that is missing or behind on this machine.'
								: 'Nothing enrolled has a bin that is missing or behind globally.',
					items: listed.length ? globalItems(listed) : ['Nothing to install globally.'],
					itemKeys: listed.map((row) => row.id),
					confirmLabel:
						eligible.length === 1
							? `${eligible[0]?.have ? 'Update' : 'Install'} ${eligible[0]?.npm ?? eligible[0]?.id}@${eligible[0]?.version}`
							: `Install ${eligible.length} globally`,
					canApply: eligible.length > 0,
					applyIds: eligible.map((row) => row.id),
					run: (included) =>
						void applyGlobal(
							eligible.map((row) => row.id).filter((id) => included.includes(id)),
							versions,
						),
				});
			},
			planOpts('Install globally', onlyIds),
		);
	}

	async function applyGlobal(
		ids: string[],
		versions?: Record<string, string>,
		opts?: { wait?: boolean },
	): Promise<void> {
		const wait = Boolean(opts?.wait);
		const verb = wait ? 'Waiting for npm' : 'installing global';
		await host.run(
			wait && ids.length === 1 ? 'Waiting for npm…' : bulkProgressLabel(verb, 1, ids.length, ids[0]),
			async () => {
				const rows: GlobalInstallRow[] = [];
				await host.eachNamed(verb, ids, async (id) => {
					const data = (await host.call('/api/global', {
						method: 'POST',
						body: JSON.stringify({ apply: true, ids: [id], versions, wait }),
					})) as { rows: GlobalInstallRow[] };
					rows.push(...data.rows);
					for (const row of data.rows) {
						if (row.reason?.startsWith('installed global ') && row.version) {
							host.patchWrite({ id: row.id, globalVersion: row.version });
						}
					}
				});
				const eligible = rows.filter((r) => r.action === 'global');
				const waiting = eligible.filter((r) => isNpmNotReadyReason(r.reason));
				const failed = eligible.filter(
					(r) => !r.reason?.startsWith('installed global ') && !isNpmNotReadyReason(r.reason),
				);
				const ok = eligible.length - failed.length - waiting.length;
				host.note(
					waiting.length
						? `global — ${waiting.map((r) => r.reason ?? 'not on npm yet').join(' · ')}`
						: failed.length
							? `global --apply — ${ok} installed, ${failed.length} failed: ${failed.map((r) => `${r.id}: ${r.reason ?? 'install failed'}`).join(' · ')}`
							: `global --apply — ${ok} installed`,
					{ rows },
				);
				await host.reloadAfterWrite(ids, 'git');
				if (waiting.length) {
					offerNpmWait(waiting, versions);
					return;
				}
				if (failed.length) {
					host.setError(failed.map((r) => `${r.id}: ${r.reason ?? 'install failed'}`).join(' · '));
				}
				host.setConfirmOpen(false);
			},
			{ closeConfirm: false },
		);
	}

	function persistPublishBatch(
		ids: string[],
		rows: PublishBatchRow[],
		opts?: { done?: boolean; error?: string },
	): void {
		const remaining = remainingAfter(ids, rows);
		host.savePublishBatch({
			ids,
			rows,
			remaining,
			githubPending: githubPendingRows(host.lastPublishPlan(), remaining),
			error: opts?.error,
			done: Boolean(opts?.done),
		});
	}

	function offerPublishOutcome(
		rows: PublishBatchRow[],
		opts?: { interrupted?: boolean; leftover?: PublishBatchRow[]; error?: string },
	): void {
		const leftover = opts?.leftover?.filter((row) => !rows.some((item) => item.id === row.id)) ?? [];
		const shown = [...rows, ...leftover];
		if (!shown.length) {
			if (host.jobStopped()) return;
			host.setConfirmOpen(false);
			host.clearPublishBatch();
			return;
		}
		const failed = rows.filter((row) => !isPublishedReason(row.reason));
		const github = shown.filter((row) => isGithubPublishReason(row.reason));
		const npmOk = rows.filter((row) => row.reason?.startsWith('published '));
		const installable = npmOk.filter((row) => {
			const project = host.inventory()?.projects.find((item) => item.id === row.id);
			return Boolean(project?.bin?.length);
		});
		const versions = Object.fromEntries(
			installable
				.filter((row) => row.version)
				.map((row) => [row.id, row.version as string]),
		);
		const skipToInstall =
			!opts?.interrupted &&
			!host.jobStopped() &&
			!failed.length &&
			!leftover.length &&
			installable.length &&
			canSkipPublishResultsForGlobalInstall(rows);
		if (skipToInstall) {
			host.clearPublishBatch();
			host.offerConfirm({
				title:
					installable.length === 1
						? `Install ${installable[0]?.npm ?? installable[0]?.id}@${installable[0]?.version} globally?`
						: `Install ${installable.length} CLIs globally?`,
				hint: 'Confirm checks npm for that version, then runs pnpm add -g (npm if pnpm is missing). A new publish can take a minute to show up. Never --force.',
				items: installable.map((row) =>
					globalInstallLine({ ...row, action: 'global' }, installable.length > 1),
				),
				itemKeys: installable.map((row) => row.id),
				confirmLabel:
					installable.length === 1
						? `Install ${installable[0]?.npm ?? installable[0]?.id}@${installable[0]?.version}`
						: `Install ${installable.length} globally`,
				canApply: true,
				applyIds: installable.map((row) => row.id),
				run: (included) => void applyGlobal(included, versions),
			});
			return;
		}
		const ordered = orderPublishResults(shown);
		const offerInstall = Boolean(
			!opts?.interrupted &&
				!host.jobStopped() &&
				!failed.length &&
				installable.length &&
				github.length,
		);
		host.offerConfirm({
			title: opts?.interrupted ? 'Publish interrupted' : host.jobStopped() ? 'Stopped' : publishResultTitle(shown),
			hint: [
				opts?.interrupted
					? 'The board reloaded or a later package failed. Finished rows are listed. GitHub links that never ran are included so you can still open them.'
					: '',
				host.jobStopped() || opts?.error ? (opts?.error ?? host.error()) : '',
				publishResultHint(shown),
				offerInstall
					? 'Install globally is for the laptop npm publishes after you open each GitHub Publish link.'
					: '',
			]
				.filter(Boolean)
				.join(' '),
			items: ordered.map(publishResultLine),
			itemKeys: ordered.map((row) => row.id),
			itemPhases: ordered.map((row) => publishResultPhase(row.reason)),
			confirmLabel: offerInstall
				? installable.length === 1
					? `Install ${installable[0]?.npm ?? installable[0]?.id}@${installable[0]?.version}`
					: `Install ${installable.length} globally`
				: 'OK',
			canApply: offerInstall,
			oncancel: () => host.clearPublishBatch(),
			run: offerInstall
				? () => {
						host.clearPublishBatch();
						void applyGlobal(
							installable.map((row) => row.id),
							versions,
						);
					}
				: undefined,
		});
	}

	async function startPublish(ids: string[]): Promise<void> {
		ids = host.readyNamed(ids);
		if (ids.length === 0) return;
		const label = ids.length === 1 ? ids[0] : `${ids.length} packages`;
		await host.run(
			`planning publish ${label}`,
			async () => {
				const kinds = host.bumpKind();
				const data = (await host.call('/api/publish', {
					method: 'POST',
					body: JSON.stringify({
						apply: false,
						ids,
						kind: ids.length === 1 ? (kinds[ids[0] ?? ''] ?? 'patch') : 'patch',
					}),
				})) as { rows: PublishRow[]; npmUser?: string | null; authHint?: string };
				host.setPublishAuthHint(data.authHint ?? '');
				if (data.npmUser) {
					host.setNpmUser(data.npmUser);
					host.persistNpmUser(data.npmUser);
				} else if (data.authHint) {
					host.setNpmUser(null);
				}
				const eligible = data.rows.filter((r) => r.action === 'publish');
				host.setLastPublishPlan(eligible);
				const cuttingNew = eligible.some((row) => row.steps.some((step) => step.kind === 'bump'));
				const githubOnly = eligible.length > 0 && eligible.every((row) => publishNeedsGithub(row.steps) && !publishNeedsNpm(row.steps));
				const needsNpm = eligible.some((row) => publishNeedsNpm(row.steps));
				host.note(`publish plan — ${eligible.length} of ${data.rows.length} eligible, nothing written`, data);
				const bumpNote = cuttingNew
					? 'Local already matches npm. Confirm bumps to this version, then publishes.'
					: '';
				const githubNote = githubOnly
					? 'These packages publish from GitHub Actions (OIDC provenance). Confirm writes the version, then open the Publish workflow.'
					: eligible.some((row) => publishNeedsGithub(row.steps))
						? 'Some packages publish from GitHub Actions. Confirm writes the version; open each GitHub Publish link instead of npm here.'
						: '';
				host.offerConfirm({
					title: eligible.length === 1
						? githubOnly
							? `Publish ${eligible[0]?.npm ?? eligible[0]?.id}@${eligible[0]?.version} and open GitHub?`
							: `Publish ${eligible[0]?.npm ?? eligible[0]?.id}@${eligible[0]?.version}?`
						: eligible.length
							? githubOnly
								? `Open GitHub Publish for ${eligible.length} packages?`
								: `Publish ${eligible.length} packages?`
							: 'Nothing to publish',
					hint: eligible.length
						? [needsNpm ? host.publishAuthHint() : '', bumpNote, githubNote].filter(Boolean).join(' ')
						: ids.length === 1
							? `${ids[0]}: ${data.rows[0]?.reason ?? 'cannot publish'}`
							: 'No listed package is ready to publish.',
					items: eligible.length
						? eligible.flatMap((row) => publishItems(row, eligible.length > 1))
						: data.rows.map((row) => `${row.id}  ${row.reason ?? 'skipped'}`),
					itemKeys: eligible.flatMap(publishItemKeys),
					confirmLabel: eligible.length === 1
						? `Publish ${eligible[0]?.version}`
						: githubOnly
							? `Open GitHub ${eligible.length}`
							: `Publish ${eligible.length}`,
					canApply: eligible.length > 0,
					showOtp: needsNpm,
					applyIds: eligible.map((row) => row.id),
					run: (included) => void applyPublish(eligible.map((row) => row.id).filter((id) => included.includes(id))),
				});
			},
			planOpts('Publish', ids),
		);
	}

	async function applyPublish(ids: string[]): Promise<void> {
		const rows: PublishRow[] = [];
		persistPublishBatch(ids, [], { done: false });
		await host.run(
			bulkProgressLabel('publishing', 1, ids.length, ids[0]),
			async () => {
				const otp = host.publishOtp().trim() ? host.publishOtp().trim() : undefined;
				await host.eachNamed('publishing', ids, async (id) => {
					try {
						const data = (await host.callNdjson(
							'/api/publish',
							{
								method: 'POST',
								body: JSON.stringify({
									apply: true,
									ids: [id],
									kind: host.bumpKind()[id] ?? 'patch',
									otp,
								}),
							},
							(event) => {
								if (event.type !== 'step') return;
								host.setConfirmPhases(
									applyConfirmStep(host.confirmItemKeys(), host.confirmPhases(), {
										id: String(event.id ?? id),
										index: Number(event.index),
										status: event.status === 'fail' || event.status === 'done' ? event.status : 'start',
									}),
								);
							},
						)) as { rows?: PublishRow[] };
						rows.push(...(data.rows ?? []));
						for (const row of data.rows ?? []) {
							if (!isPublishedReason(row.reason) || !row.version) continue;
							host.patchWrite({
								id: row.id,
								localVersion: row.version,
								npmLatest: row.version,
								commitsSinceNpm: 0,
								gitAhead: 0,
							});
						}
					} catch (err) {
						const reason = err instanceof Error ? err.message : String(err);
						rows.push({ id, path: '', action: 'publish', version: null, steps: [], reason });
						host.setError(reason);
						if (host.confirmItemKeys().includes(id)) {
							host.setConfirmPhases(markConfirmKey(host.confirmItemKeys(), host.confirmPhases(), id, 'fail'));
						}
					}
					persistPublishBatch(ids, rows, { error: host.error() || undefined });
				});
				host.note(publishApplyTitle(rows), { rows: slimPublishRows(rows) });
				host.setPublishOtp('');
				await host.reloadAfterWrite(rows.map((row) => row.id), 'git');
			},
			{ closeConfirm: false },
		);
		persistPublishBatch(ids, rows, { done: !host.jobStopped(), error: host.error() || undefined });
		offerPublishOutcome(rows, {
			leftover: githubPendingRows(host.lastPublishPlan(), remainingAfter(ids, rows)),
			error: host.error() || undefined,
		});
	}

	async function startCascade(id: string): Promise<void> {
		await host.run(
			`planning cascade ${id}`,
			async () => {
				const data = (await host.call('/api/cascade', {
					method: 'POST',
					body: JSON.stringify({ id, apply: false }),
				})) as { to: string; npm: string; rows: { action: string; writes?: boolean }[]; note: string };
				const n = data.rows.filter((r) => r.action === 'retarget').length;
				host.note(`cascade plan ${data.npm}@${data.to} — ${n} pin(s) to retarget. ${data.note}`, data);
				const lined = formatRowLines(data);
				host.offerConfirm({
					title: n ? `Write ${data.npm}@${data.to} pins?` : `Nothing to cascade for ${id}`,
					hint: n
						? `${data.note} Writes pins and lockfiles. Commits by default.`
						: data.note || 'No dependents need a pin update.',
					items: lined.length ? lined : ['Nothing to retarget.'],
					confirmLabel: n ? `Write ${data.npm}@${data.to}` : 'Write pins',
					canApply: n > 0,
					run: () => void applyCascade(id),
				});
			},
			planOpts('Cascade', [id]),
		);
	}

	async function applyCascade(id: string): Promise<void> {
		await host.run(`cascading ${id}`, async () => {
			const data = (await host.call('/api/cascade', {
				method: 'POST',
				body: JSON.stringify({ id, apply: true }),
			})) as { to: string; npm: string; rows: { action: string; writes?: boolean; fromId: string }[]; note: string };
			host.note(`cascade ${data.npm}@${data.to} — wrote ${data.rows.filter((r) => r.writes).length} pin(s)`, data);
			const wrote = data.rows.filter((row) => row.writes).map((row) => row.fromId);
			await host.reloadAfterWrite([...new Set([id, ...wrote])], 'light');
		});
	}

	return {
		startBump,
		startCommit,
		startPull,
		startPush,
		startShip,
		startGlobal,
		applyGlobal,
		startPublish,
		offerPublishOutcome,
		startCascade,
	};
}

function formatRowLines(data: unknown): string[] {
	return formatPluginPlanLines(data);
}
