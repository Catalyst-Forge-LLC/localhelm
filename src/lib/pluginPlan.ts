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

function isSpace(ch: string | undefined): boolean {
	return ch === ' ' || ch === '\t';
}

/** Pull a trailing ` in <folder>` off a command so the folder can sit on its own line. */
export function splitCommandCwd(text: string): { command: string; cwd: string } {
	let i = text.length - 1;
	while (i >= 0 && !isSpace(text[i])) i -= 1;
	const cwd = text.slice(i + 1);
	if (!cwd) return { command: text, cwd: '' };
	let j = i;
	while (j >= 0 && isSpace(text[j])) j -= 1;
	if (j < 1 || text[j] !== 'n' || text[j - 1] !== 'i') return { command: text, cwd: '' };
	let k = j - 2;
	if (k < 0 || !isSpace(text[k])) return { command: text, cwd: '' };
	while (k >= 0 && isSpace(text[k])) k -= 1;
	const command = text.slice(0, k + 1).trim();
	if (!command) return { command: text, cwd: '' };
	return { command, cwd };
}

function stripRecipeSuffix(reason: string): string {
	const dash = reason.lastIndexOf('—');
	if (dash < 1 || !isSpace(reason[dash - 1])) return reason;
	let i = dash + 1;
	while (i < reason.length && isSpace(reason[i])) i += 1;
	const rest = reason.slice(i).toLowerCase();
	if (!rest.startsWith('localslip recipe') && !rest.startsWith('localberth recipe')) return reason;
	let j = dash - 1;
	while (j >= 0 && isSpace(reason[j])) j -= 1;
	return reason.slice(0, j + 1);
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
	const rows = pluginPlanRows(data);
	const named = rows.length > 1;
	return rows.map((row) => {
		const id = pluginRowId(row);
		const recipe = typeof row.recipe === 'string' ? row.recipe.trim() : '';
		const proposedCwd = typeof row.proposedCwd === 'string' ? row.proposedCwd.trim() : '';
		const proposedCommand = typeof row.proposedCommand === 'string' ? row.proposedCommand.trim() : '';
		const rowAction = typeof row.action === 'string' ? row.action : '';
		const showStartRecipe = Boolean(recipe) && (!rowAction || rowAction === 'start' || rowAction === 'recipe');
		if (showStartRecipe) {
			return planBlock([named ? id : '', cwdLine(proposedCwd), recipe, envBits(row)]);
		}
		if (rowAction === 'skip') {
			const why =
				typeof row.reason === 'string'
					? stripRecipeSuffix(row.reason)
					: 'nothing to do';
			return named ? `${id}  —  ${why}` : why;
		}
		const detail = jobDetail(row, rowAction);
		const from = typeof row.from === 'string' ? row.from : typeof row.fromSpec === 'string' ? row.fromSpec : '';
		const to = typeof row.to === 'string' ? row.to : typeof row.toSpec === 'string' ? row.toSpec : '';
		const range = from && to ? `${from} → ${to}` : from || to;
		const parsed = splitCommandCwd(detail);
		const cwd = proposedCwd || parsed.cwd;
		const command = proposedCommand || parsed.command;
		const showAction = Boolean(rowAction) && rowAction !== 'ship' && !command.startsWith(rowAction);
		const bits = [named ? id : '', showAction ? rowAction : '', range, cwdLine(cwd), command];
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
