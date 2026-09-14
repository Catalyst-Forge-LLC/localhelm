export type LandBatchRow = {
	id: string;
	ok: boolean;
	reason?: string;
};

export function landConfirmItems(
	plans: readonly { siteId: string; steps: readonly { label: string }[] }[],
): { items: string[]; keys: string[] } {
	const multi = plans.length > 1;
	const items: string[] = [];
	const keys: string[] = [];
	for (const plan of plans) {
		if (!plan.steps.length) {
			items.push(multi ? `${plan.siteId}  already current` : 'Already current.');
			keys.push(plan.siteId);
			continue;
		}
		plan.steps.forEach((step, i) => {
			items.push(multi ? `${plan.siteId}  ${step.label}` : step.label);
			keys.push(`${plan.siteId}:${i}`);
		});
	}
	return { items, keys };
}

export function landRowFromApply(
	siteId: string,
	result: { ok: boolean; stoppedAt?: string; steps: readonly { ok: boolean; label: string; reason?: string }[] },
): LandBatchRow {
	if (result.ok) return { id: siteId, ok: true, reason: 'landed' };
	const failed = result.steps.filter((step) => !step.ok);
	return {
		id: siteId,
		ok: false,
		reason:
			failed.map((step) => `${step.label}: ${step.reason ?? 'failed'}`).join(' · ') ||
			result.stoppedAt ||
			'land failed',
	};
}

export function landResultLine(row: LandBatchRow): string {
	return row.ok ? `${row.id}  landed` : `${row.id}  ${row.reason ?? 'failed'}`;
}

export function orderLandResults<T extends LandBatchRow>(rows: readonly T[]): T[] {
	return [...rows].sort((a, b) => Number(a.ok) - Number(b.ok));
}

export function landApplyTitle(rows: readonly LandBatchRow[]): string {
	const failed = rows.filter((row) => !row.ok);
	const ok = rows.length - failed.length;
	if (!failed.length) return `land --apply — ${ok} site(s) ok`;
	return `land --apply — ${ok} ok, ${failed.length} failed: ${failed.map((row) => row.id).join(', ')}`;
}

export function landResultTitle(
	rows: readonly LandBatchRow[],
	opts?: { interrupted?: boolean; stopped?: boolean },
): string {
	if (opts?.stopped) return 'Stopped';
	if (opts?.interrupted) return 'Land interrupted';
	const failed = rows.filter((row) => !row.ok);
	const ok = rows.length - failed.length;
	if (!rows.length) return 'Nothing landed';
	if (failed.length === rows.length) {
		return rows.length === 1 ? 'Land failed' : `Nothing landed (${rows.length} failed)`;
	}
	if (failed.length) return `${failed.length} of ${rows.length} failed`;
	if (rows.length === 1) return `Landed ${rows[0]?.id}`;
	return `Landed ${ok} sites`;
}

export function landResultHint(rows: readonly LandBatchRow[]): string {
	if (rows.some((row) => !row.ok)) {
		return 'Failed names are first. A failed ship stays pending on Today Land.';
	}
	return 'Listed sites finished Land.';
}

export function landResultPhase(row: LandBatchRow): 'done' | 'fail' {
	return row.ok ? 'done' : 'fail';
}

export function landBatchSnap(
	ids: string[],
	rows: readonly LandBatchRow[],
	opts?: { done?: boolean; error?: string },
): { ids: string[]; rows: LandBatchRow[]; remaining: string[]; error?: string; done: boolean } {
	const finished = new Set(rows.map((row) => row.id));
	return {
		ids,
		rows: [...rows],
		remaining: ids.filter((id) => !finished.has(id)),
		error: opts?.error,
		done: Boolean(opts?.done),
	};
}
