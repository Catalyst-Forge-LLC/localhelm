export type ActivityStamp = { at: string };

export type ActivityDay = {
	key: string;
	label: string;
	dom: string;
	count: number;
	firstAt: string;
};

export type ActivityMonth = {
	key: string;
	label: string;
	days: ActivityDay[];
};

function localDate(at: string): Date | null {
	const when = new Date(at);
	return Number.isNaN(when.getTime()) ? null : when;
}

/** Local calendar day `YYYY-MM-DD`. */
export function activityDayKey(at: string): string | null {
	const when = localDate(at);
	if (!when) return null;
	const y = when.getFullYear();
	const m = String(when.getMonth() + 1).padStart(2, '0');
	const d = String(when.getDate()).padStart(2, '0');
	return `${y}-${m}-${d}`;
}

function fromKey(key: string): Date {
	const [y, m, d] = key.split('-').map(Number);
	return new Date(y ?? 0, (m ?? 1) - 1, d ?? 1);
}

function dayLabel(key: string, now: Date): string {
	const when = fromKey(key);
	return when.toLocaleString(undefined, {
		month: 'short',
		day: 'numeric',
		year: when.getFullYear() === now.getFullYear() ? undefined : 'numeric',
	});
}

function monthLabel(monthKey: string, now: Date): string {
	const [y, m] = monthKey.split('-').map(Number);
	const when = new Date(y ?? 0, (m ?? 1) - 1, 1);
	return when.toLocaleString(undefined, {
		month: 'short',
		year: when.getFullYear() === now.getFullYear() ? undefined : 'numeric',
	});
}

/** Newest day first. */
export function activityDayGroups(entries: ActivityStamp[], now = new Date()): ActivityDay[] {
	const map = new Map<string, ActivityDay>();
	for (const entry of entries) {
		const key = activityDayKey(entry.at);
		if (!key) continue;
		const seen = map.get(key);
		if (seen) {
			seen.count += 1;
			if (entry.at > seen.firstAt) seen.firstAt = entry.at;
			continue;
		}
		map.set(key, {
			key,
			label: dayLabel(key, now),
			dom: String(fromKey(key).getDate()),
			count: 1,
			firstAt: entry.at,
		});
	}
	return [...map.values()].sort((a, b) => (a.key < b.key ? 1 : -1));
}

/** Newest month first; days inside stay newest first. */
export function activityMonthGroups(days: ActivityDay[], now = new Date()): ActivityMonth[] {
	const map = new Map<string, ActivityMonth>();
	for (const day of days) {
		const monthKey = day.key.slice(0, 7);
		const seen = map.get(monthKey);
		if (seen) {
			seen.days.push(day);
			continue;
		}
		map.set(monthKey, { key: monthKey, label: monthLabel(monthKey, now), days: [day] });
	}
	return [...map.values()];
}

/** Oldest → newest. Last slot is today. */
export function activitySparkSeries(entries: ActivityStamp[], days = 14, now = new Date()): number[] {
	const counts = new Map<string, number>();
	for (const entry of entries) {
		const key = activityDayKey(entry.at);
		if (!key) continue;
		counts.set(key, (counts.get(key) ?? 0) + 1);
	}
	const out: number[] = [];
	for (let i = days - 1; i >= 0; i -= 1) {
		const day = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
		const key = `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, '0')}-${String(day.getDate()).padStart(2, '0')}`;
		out.push(counts.get(key) ?? 0);
	}
	return out;
}

export function activitySparkCaption(series: number[]): string {
	const today = series.at(-1) ?? 0;
	const total = series.reduce((sum, n) => sum + n, 0);
	if (total === 0) return 'No writes in the log';
	if (today > 0) return `${today} today · ${total} in ${series.length}d`;
	return `${total} writes · last ${series.length}d`;
}
