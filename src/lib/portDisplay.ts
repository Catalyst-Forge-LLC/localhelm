export type BoardColumn = { id: string; label: string };

const HIDDEN_LEASE_COLS = new Set(['listening', 'health', 'log', 'firewall']);

/** LocalSlip already sent listening / health / log / firewall. Helm keeps port, bind, process, recipe. */
export function portTableColumns(
	plugin: string,
	pane: 'leases' | 'observed',
	columns: readonly BoardColumn[],
): BoardColumn[] {
	if (plugin !== 'localslip' || pane !== 'leases') return [...columns];
	return columns.filter((col) => !HIDDEN_LEASE_COLS.has(col.id));
}

export function portRecipeLabel(cells: Record<string, string>): string {
	const recipe = (cells.recipe ?? '').trim();
	const health = (cells.health ?? '').trim();
	const firewall = (cells.firewall ?? '').trim();
	const parts: string[] = [];
	if (recipe && recipe !== '—') parts.push(recipe);
	else if (health && health !== 'ok' && health !== '—') parts.push(health.replace(/-/g, ' '));
	else parts.push('—');
	if (firewall && firewall !== '—' && firewall !== 'skipped') parts.push(firewall);
	return parts.join(' · ');
}

export function portCellValue(colId: string, cells: Record<string, string>): string {
	if (colId === 'recipe') return portRecipeLabel(cells);
	return cells[colId] ?? '—';
}
