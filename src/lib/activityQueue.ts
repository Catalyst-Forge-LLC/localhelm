import type { ActivityEntry, ActivitySnapshot } from './activity.js';
import type { JournalStorage } from './jobJournal.js';
export type QueuedActivity = ActivityEntry & { id: string };
export function activityQueueKey(workspace: string, demo: boolean): string { return `localhelm.activity.v1:${encodeURIComponent(workspace)}:${demo ? 'demo' : 'main'}`; }
export function mergeActivityEntries(...groups: ActivityEntry[][]): ActivityEntry[] {
	const rows = new Map<string, ActivityEntry>();
	for (const group of groups) for (const row of group) rows.set(row.id ?? `${row.at}\0${row.title}\0${row.body}`, row);
	return [...rows.values()].sort((a, b) => b.at.localeCompare(a.at)).slice(0, 200);
}
/** A clear-generation mismatch retains queued entries for an explicit review. */
export class ActivityQueue {
	pending: QueuedActivity[] = [];
	server: ActivityEntry[] = [];
	generation: string | null = null;
	serverGeneration: string | null = null;
	blocked = false;
	constructor(private storage: JournalStorage, readonly key: string) {
		const raw = storage.getItem(key); if (!raw) return;
		const parsed = JSON.parse(raw) as { version?: unknown; generation?: unknown; pending?: QueuedActivity[] };
		if (parsed.version !== 1 || !Array.isArray(parsed.pending) || parsed.pending.some((entry) => !entry || typeof entry.id !== 'string' || typeof entry.at !== 'string' || typeof entry.title !== 'string' || typeof entry.body !== 'string') || (parsed.generation !== null && typeof parsed.generation !== 'string')) throw new Error('Queued Activity is unreadable. Preserve browser storage before discarding it.');
		this.pending = parsed.pending; this.generation = parsed.generation as string | null;
	}
	private persist(): void { this.storage.setItem(this.key, JSON.stringify({ version: 1, generation: this.generation, pending: this.pending })); }
	get entries(): ActivityEntry[] { return mergeActivityEntries(this.server, this.pending); }
	enqueue(entry: QueuedActivity): void { this.pending = [...this.pending, entry]; this.persist(); }
	load(snapshot: ActivitySnapshot): void {
		this.server = this.serverGeneration === snapshot.generation ? mergeActivityEntries(this.server, snapshot.entries) : snapshot.entries;
		this.serverGeneration = snapshot.generation;
		if (this.generation === null || !this.pending.length) this.generation = snapshot.generation;
		this.blocked = this.generation !== snapshot.generation;
		this.persist();
	}
	ack(id: string, snapshot: ActivitySnapshot): void {
		if (snapshot.generation !== this.generation) { this.load(snapshot); throw new Error('Activity changed while saving. Review queued entries.'); }
		const previous = this.pending;
		this.pending = this.pending.filter((entry) => entry.id !== id);
		try { this.load(snapshot); } catch (err) { this.pending = previous; throw err; }
	}
	cleared(snapshot: ActivitySnapshot, capturedIds: string[]): void {
		this.pending = this.pending.filter((entry) => !capturedIds.includes(entry.id));
		this.generation = snapshot.generation; this.serverGeneration = snapshot.generation; this.server = snapshot.entries; this.blocked = false; this.persist();
	}
	rebase(): void { if (!this.serverGeneration) throw new Error('Refresh Activity first.'); this.generation = this.serverGeneration; this.blocked = false; this.persist(); }
	discard(): void { this.pending = []; this.generation = this.serverGeneration; this.blocked = false; this.persist(); }
}
