/** Compact local date + time for the activity log. Year only when it is not this year. */
export function formatActivityAt(at: string, now = new Date()): string {
	const when = new Date(at);
	if (Number.isNaN(when.getTime())) return at;
	const sameYear = when.getFullYear() === now.getFullYear();
	return when.toLocaleString(undefined, {
		month: 'short',
		day: 'numeric',
		year: sameYear ? undefined : 'numeric',
		hour: 'numeric',
		minute: '2-digit',
		second: '2-digit',
	});
}
