/** Apply must match the plan the operator reviewed, including its source/HEAD revision. */
export function assertPublishConfirmation(rows: { id: string; action: string; revision?: string }[], confirmed?: Record<string, string>): void {
	if (rows.some((row) => row.action === 'publish' && (!row.revision || confirmed?.[row.id] !== row.revision))) {
		throw new Error('Publish plan changed or its confirmation is missing. Refresh and open a new Publish plan.');
	}
}
