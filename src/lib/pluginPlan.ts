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

function cwdLine(cwd: string): string {
	return cwd ? `in ${cwd}` : '';
}

/** Pull a trailing ` in <folder>` off a command so the folder can sit on its own line. */
export function splitCommandCwd(text: string): { command: string; cwd: string } {
	const match = text.match(/^(.+?)\s+in\s+(\S+)$/);
	if (!match?.[1] || !match[2]) return { command: text, cwd: '' };
	return { command: match[1].trim(), cwd: match[2] };
}

function planBlock(parts: Array<string | undefined>): string {
	return parts.filter((part): part is string => Boolean(part)).join('\n');
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

function pluginPlanRows(data: unknown): Record<string, unknown>[] {
	if (!data || typeof data !== 'object') return [];
	const rows = (data as { rows?: unknown }).rows;
	if (!Array.isArray(rows)) return [];
	return rows.filter((row): row is Record<string, unknown> => Boolean(row) && typeof row === 'object');
}

function pluginRowId(row: Record<string, unknown>): string {
	if (typeof row.id === 'string') return row.id;
	if (typeof row.fromId === 'string') return row.fromId;
	if (typeof row.path === 'string') return row.path;
	return '?';
}

/** Keys aligned with `formatPluginPlanLines` so a multi-id confirm can use the roster. */
export function pluginPlanLineKeys(data: unknown): string[] {
	return pluginPlanRows(data).map(pluginRowId);
}

/** Confirm lines for plugin plans. Start/recipe rows include PORT/HOST. Stop/park do not. */
export function formatPluginPlanLines(data: unknown): string[] {
	return pluginPlanRows(data).map((row) => {
		const id = pluginRowId(row);
			const recipe = typeof row.recipe === 'string' ? row.recipe.trim() : '';
			const proposedCwd = typeof row.proposedCwd === 'string' ? row.proposedCwd.trim() : '';
			const proposedCommand = typeof row.proposedCommand === 'string' ? row.proposedCommand.trim() : '';
			const rowAction = typeof row.action === 'string' ? row.action : '';
			const showStartRecipe = Boolean(recipe) && (!rowAction || rowAction === 'start' || rowAction === 'recipe');
			if (showStartRecipe) {
				return planBlock([id, cwdLine(proposedCwd), recipe, envBits(row)]);
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
			const parsed = splitCommandCwd(detail);
			const cwd = proposedCwd || parsed.cwd;
			const command = proposedCommand || parsed.command;
			const showAction = Boolean(rowAction) && rowAction !== 'ship' && !command.startsWith(rowAction);
			const bits = [id, showAction ? rowAction : '', range, cwdLine(cwd), command];
			return cwd ? planBlock(bits) : bits.filter(Boolean).join('  ');
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
