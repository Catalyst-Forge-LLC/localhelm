/** Busy copy for a named item in a bulk job. One item keeps the short form. */
export function bulkProgressLabel(verb: string, index: number, total: number, name?: string): string {
	const safeVerb = verb.trim() || 'working';
	const n = Math.max(1, index);
	const of = Math.max(n, total);
	if (of <= 1) return name ? `${safeVerb} ${name}` : safeVerb;
	const count = `${n} of ${of}`;
	return name ? `${safeVerb} ${count} · ${name}` : `${safeVerb} ${count}`;
}
