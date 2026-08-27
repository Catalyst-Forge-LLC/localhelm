function envBits(row: Record<string, unknown>): string {
	const port =
		typeof row.port === 'number'
			? String(row.port)
			: typeof row.port === 'string' && row.port.trim()
				? row.port.trim()
				: '';
	const host =
		typeof row.host === 'string' && row.host.trim()
			? row.host.trim()
			: typeof row.bind === 'string' && row.bind.trim()
				? row.bind.trim()
				: '';
	if (port && host) return `PORT=${port} HOST=${host}`;
	if (port) return `PORT=${port}`;
	if (host) return `HOST=${host}`;
	return '';
}

function textField(row: Record<string, unknown>, key: string): string {
	const value = row[key];
	return typeof value === 'string' ? value.trim() : '';
}

/** Job detail only — never FilePress leftover cells (update / headers) on ship or push. */
function jobDetail(row: Record<string, unknown>, action: string): string {
	const reason = textField(row, 'reason');
	if (reason) return reason;
	if (action === 'sync') return textField(row, 'update');
	if (action === 'ship') {
		const ship = textField(row, 'ship');
		if (ship && ship !== 'skipped' && ship !== 'yes' && ship !== 'no') return ship;
		return 'pnpm ship';
	}
	return '';
}

/** Confirm lines for plugin plans. Start/recipe rows include PORT/HOST. Stop/park do not. */
export function formatPluginPlanLines(data: unknown): string[] {
	if (!data || typeof data !== 'object') return [];
	const rows = (data as { rows?: unknown }).rows;
	if (!Array.isArray(rows)) return [];
	return rows
		.filter((row): row is Record<string, unknown> => Boolean(row) && typeof row === 'object')
		.map((row) => {
			const id =
				typeof row.id === 'string'
					? row.id
					: typeof row.fromId === 'string'
						? row.fromId
						: typeof row.path === 'string'
							? row.path
							: '?';
			const recipe = typeof row.recipe === 'string' ? row.recipe.trim() : '';
			const cwd = typeof row.proposedCwd === 'string' ? row.proposedCwd : '';
			const rowAction = typeof row.action === 'string' ? row.action : '';
			const showStartRecipe = Boolean(recipe) && (!rowAction || rowAction === 'start' || rowAction === 'recipe');
			if (showStartRecipe) {
				return [id, recipe, envBits(row), cwd ? `in ${cwd}` : ''].filter(Boolean).join('  ');
			}
			if (rowAction === 'skip') {
				const why =
					typeof row.reason === 'string'
						? row.reason.replace(/\s+—\s+(localslip|localberth) recipe.*$/, '')
						: 'nothing to do';
				return `${id}  —  ${why}`;
			}
			const detail = jobDetail(row, rowAction);
			const from = typeof row.from === 'string' ? row.from : typeof row.fromSpec === 'string' ? row.fromSpec : '';
			const to = typeof row.to === 'string' ? row.to : typeof row.toSpec === 'string' ? row.toSpec : '';
			const range = from && to ? `${from} → ${to}` : from || to;
			const guess =
				typeof row.proposedCommand === 'string' && typeof row.proposedCwd === 'string'
					? `${row.proposedCommand} in ${row.proposedCwd}`
					: '';
			const showAction = Boolean(rowAction) && rowAction !== 'ship' && !detail.startsWith(rowAction);
			return [id, showAction ? rowAction : '', range, detail, guess].filter(Boolean).join('  ');
		});
}

/** If the plan lists `writes` on rows, return only those ids. `null` means the shape is unknown. */
export function pluginPlanWriteIds(data: unknown): string[] | null {
	if (!data || typeof data !== 'object') return null;
	const rows = (data as { rows?: unknown }).rows;
	if (!Array.isArray(rows)) return null;
	const typed = rows.filter((row): row is Record<string, unknown> => Boolean(row) && typeof row === 'object');
	if (!typed.some((row) => typeof row.writes === 'boolean')) return null;
	return typed.filter((row) => row.writes === true && typeof row.id === 'string').map((row) => String(row.id));
}
