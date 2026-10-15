import { StatusReads, type StatusRead } from './statusReads.js';
import type { PluginBoard } from './plugin.js';
export type PluginMeta = { id: string; label: string; source?: string; enabled: boolean };
export type PluginFault = { source: string; message: string; plugin?: string };
export type PluginSnapshot = { boards: PluginBoard[]; plugins?: { id: string; label: string; source?: string; enabled?: boolean }[]; faults?: PluginFault[] };
export type PluginReadState = { pending: boolean; readAt?: string; error?: string };
/** Full and scoped reads share per-plugin order and one Main/Demo epoch. */
export class PluginReads {
	readonly reads = new StatusReads();
	boards: PluginBoard[] = [];
	plugins: PluginMeta[] = [];
	faults: PluginFault[] = [];
	states: Record<string, PluginReadState> = {};
	ready = false;
	private ids(): string[] { return [...new Set([...this.plugins.map((p) => p.id), ...this.boards.map((b) => b.plugin)])]; }
	private owner(fault: PluginFault, metas = this.plugins): string { return fault.plugin ?? metas.find((meta) => meta.source === fault.source || meta.id === fault.source)?.id ?? fault.source; }
	begin(id?: string): StatusRead {
		const ticket = this.reads.begin(id ? [id] : []);
		for (const key of id ? [id] : this.ids()) this.states[key] = { ...this.states[key], pending: true };
		return ticket;
	}
	apply(ticket: StatusRead, data: PluginSnapshot): boolean {
		if (!this.reads.current(ticket)) return false;
		const incoming = data.plugins?.map((meta) => ({ ...meta, enabled: meta.enabled !== false }));
		const metas = [...this.plugins, ...(incoming ?? [])];
		const ids = ticket.ids.length ? ticket.ids : [...new Set([...this.ids(), ...(incoming?.map((p) => p.id) ?? []), ...data.boards.map((b) => b.plugin)])];
		const accepted = ids.filter((id) => this.reads.accepts(ticket, id));
		if (!accepted.length && (ticket.ids.length || !this.reads.accepts(ticket, '*'))) return false;
		for (const id of accepted) {
			const fault = data.faults?.find((fault) => this.owner(fault, metas) === id);
			const meta = incoming?.find((meta) => meta.id === id);
			if (incoming && (!ticket.ids.length || meta)) this.plugins = meta ? this.plugins.some((p) => p.id === id) ? this.plugins.map((p) => p.id === id ? meta : p) : [...this.plugins, meta] : this.plugins.filter((p) => p.id !== id);
			if (!fault) this.boards = [...this.boards.filter((board) => board.plugin !== id), ...(meta?.enabled === false ? [] : data.boards.filter((board) => board.plugin === id))];
			this.states[id] = { pending: false, readAt: fault ? this.states[id]?.readAt : new Date().toISOString(), error: fault?.message };
		}
		const acceptsFault = (fault: PluginFault): boolean => { const owner = this.owner(fault, metas); return accepted.includes(owner) || (!ticket.ids.length && !ids.includes(owner) && this.reads.accepts(ticket, '*')); };
		this.faults = [...this.faults.filter((fault) => !acceptsFault(fault)), ...(data.faults ?? []).filter(acceptsFault)];
		this.ready = true; return true;
	}
	fail(ticket: StatusRead, message: string): void {
		if (!this.reads.current(ticket)) return;
		const ids = ticket.ids.length ? ticket.ids : this.ids();
		if (!ids.some((id) => this.reads.accepts(ticket, id)) && (ticket.ids.length || !this.reads.accepts(ticket, '*'))) return;
		for (const id of ids) if (this.reads.accepts(ticket, id)) {
			this.states[id] = { ...this.states[id], pending: false, error: message };
			this.faults = [...this.faults.filter((fault) => this.owner(fault) !== id), { source: id, plugin: id, message }];
		}
		if (!ticket.ids.length && !ids.length && this.reads.accepts(ticket, '*')) this.faults = [...this.faults.filter((fault) => fault.source !== '*'), { source: '*', message }];
		this.ready = true;
	}
	finish(ticket: StatusRead): void { this.reads.finish(ticket); }
	reset(): void { this.reads.reset(); this.boards = []; this.plugins = []; this.faults = []; this.states = {}; this.ready = false; }
}
