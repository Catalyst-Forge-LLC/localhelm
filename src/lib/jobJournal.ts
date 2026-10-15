/** Durable browser receipts. Store identities/results, never credentials or write payloads. */
export type JobState = 'pending' | 'running' | 'succeeded' | 'failed' | 'unknown';
export type JobSubject = { id: string; state: JobState; detail?: string };
export type JobOperation = { route: string; plugin?: string; action?: string; publisher?: string };
export type DurableJob = { id: string; title: string; startedAt: string; updatedAt: string; subjects: JobSubject[]; operation?: JobOperation; reconciledAt?: string; reviewedAt?: string };
export type JournalStorage = Pick<Storage, 'getItem' | 'setItem'>;
export function jobStorageKey(workspace: string, demo: boolean): string { return `localhelm.jobs.v1:${encodeURIComponent(workspace)}:${demo ? 'demo' : 'main'}`; }
const states = new Set<JobState>(['pending', 'running', 'succeeded', 'failed', 'unknown']);
export function unresolvedJob(job: DurableJob): boolean { return !job.reviewedAt && job.subjects.some((subject) => subject.state !== 'succeeded'); }

export class JobJournal {
	jobs: DurableJob[] = [];
	constructor(private storage: JournalStorage, readonly key: string) {
		const raw = storage.getItem(key);
		if (!raw) return;
		const parsed = JSON.parse(raw) as { version?: unknown; jobs?: DurableJob[] };
		if (parsed.version !== 1 || !Array.isArray(parsed.jobs) || parsed.jobs.some((job) => !job || typeof job.id !== 'string' || typeof job.title !== 'string' || typeof job.startedAt !== 'string' || typeof job.updatedAt !== 'string' || !Array.isArray(job.subjects) || job.subjects.some((s) => !s || typeof s.id !== 'string' || !states.has(s.state)))) throw new Error('Saved action history is unreadable. Preserve it before clearing browser storage.');
		this.jobs = parsed.jobs.map((job) => ({ ...job, subjects: job.subjects.map((s) => s.state === 'running' ? { ...s, state: 'unknown', detail: 'Connection ended before acknowledgement. Refresh status before opening a new plan.' } : s) }));
		this.persist();
	}
	private persist(): void { this.storage.setItem(this.key, JSON.stringify({ version: 1, jobs: this.jobs })); }
	private update(id: string, change: (job: DurableJob) => DurableJob): DurableJob {
		const previous = this.jobs;
		this.jobs = this.jobs.map((job) => job.id === id ? { ...change(job), updatedAt: new Date().toISOString() } : job);
		try { this.persist(); } catch (err) { this.jobs = previous; throw err; }
		return this.jobs.find((job) => job.id === id)!;
	}
	begin(title: string, ids: string[], operation?: JobOperation): string {
		if (this.jobs.filter(unresolvedJob).length >= 50) throw new Error('Review the 50 unfinished actions before starting another.');
		const at = new Date().toISOString(); const id = globalThis.crypto.randomUUID();
		const previous = this.jobs;
		this.jobs = [{ id, title, startedAt: at, updatedAt: at, operation, subjects: [...new Set(ids)].map((id) => ({ id, state: 'pending' as const })) }, ...this.jobs.filter((job, index) => unresolvedJob(job) || index < 30)];
		try { this.persist(); } catch (err) { this.jobs = previous; throw err; }
		return id;
	}
	start(id: string, ids: string[], operation: JobOperation): void {
		this.update(id, (job) => ({ ...job, operation: job.operation ?? operation, subjects: [...job.subjects, ...ids.filter((id) => !job.subjects.some((s) => s.id === id)).map((id) => ({ id, state: 'pending' as const }))].map((s) => ids.includes(s.id) ? { id: s.id, state: 'running' } : s) }));
	}
	settle(id: string, ids: string[], state: JobState, detail: string): void {
		this.update(id, (job) => ({ ...job, subjects: job.subjects.map((s) => ids.includes(s.id) ? { ...s, state, detail } : s) }));
	}
	finish(id: string): void {
		this.update(id, (job) => ({ ...job, subjects: job.subjects.map((s) => s.state === 'running' ? { ...s, state: 'unknown', detail: 'No final acknowledgement. Refresh status before a new plan.' } : s) }));
	}
	reconciled(id: string): void { this.update(id, (job) => ({ ...job, reconciledAt: new Date().toISOString() })); }
	reviewed(id: string): void { this.update(id, (job) => { if (!job.reconciledAt) throw new Error('Refresh status before marking this result reviewed.'); return { ...job, reviewedAt: new Date().toISOString() }; }); }
}

export function jobRequest(url: string, body: unknown): { ids: string[]; operation: JobOperation } | null {
	if (!body || typeof body !== 'object' || (body as { apply?: unknown }).apply !== true) return null;
	const data = body as { ids?: unknown; id?: unknown; action?: unknown; siteIds?: unknown; siteId?: unknown; paths?: unknown };
	const names = data.siteIds ?? data.ids ?? data.paths;
	const name = data.siteId ?? data.id;
	let ids = Array.isArray(names) ? names.filter((id): id is string => typeof id === 'string') : typeof name === 'string' ? [name] : [];
	if (url === '/api/plugin' && data.id === 'featurefacts' && data.action === 'review') ids = ids.slice(0, 1);
	return { ids, operation: { route: url, ...(url === '/api/plugin' && typeof data.id === 'string' ? { plugin: data.id, action: typeof data.action === 'string' ? data.action : undefined } : {}) } };
}

/** A terminal transport response is not itself proof of a completed write. */
export function jobAcknowledgement(data: unknown, id: string, operation?: JobOperation): { state: JobState; detail: string } {
	if (!data || typeof data !== 'object') return { state: 'unknown', detail: 'Response did not identify the result. Refresh status.' };
	const root = data as Record<string, unknown>;
	if (operation?.route === '/api/cascade' && Array.isArray(root.rows)) {
		const pins = (root.rows as Record<string, unknown>[]).filter((row) => row.fromId === id);
		if (!pins.length) return { state: 'unknown', detail: 'No dependent result. Refresh status.' };
		const failed = pins.find((row) => row.action === 'skip' || /lockfile:|commit:|did not resolve|failed/i.test(String(row.reason ?? '')));
		if (failed) return { state: 'failed', detail: String(failed.reason ?? 'Dependent was skipped.') };
		return pins.every((row) => row.writes === true || String(row.reason ?? '').startsWith('already resolves')) ? { state: 'succeeded', detail: 'Dependent version pins acknowledged.' } : { state: 'unknown', detail: 'Review dependent files and lockfile status.' };
	}
	const values = root.rows ?? root.results;
	const rows = Array.isArray(values) ? values as Record<string, unknown>[] : [];
	const row = rows.find((row) => (row.id ?? row.siteId) === id) ?? (rows.length === 1 && !rows[0]?.id && !rows[0]?.siteId ? rows[0] : Array.isArray(values) ? undefined : root);
	if (!row) return { state: 'unknown', detail: 'No result for this subject. Refresh status.' };
	const stepError = Array.isArray(row.steps) ? (row.steps as Record<string, unknown>[]).find((step) => step.ok === false)?.reason : undefined;
	const detail = String(row.reason ?? row.detail ?? row.error ?? stepError ?? (row.writes === true || row.ok === true ? 'Write acknowledged.' : 'Result acknowledged; check current status.'));
	if (operation?.route === '/api/commit' && row.action === 'commit' && !row.reason && root.writes === true) return { state: 'succeeded', detail: 'Commit acknowledged.' };
	if (row.ok === false || row.action === 'skip' || /^(?:pack:|push:|publish:|bump:|commit:|error|failed|skipped)/i.test(detail)) return { state: 'failed', detail };
	if (row.ok === true || row.writes === true || /^(?:published\b|pushed\b|committed\b|pulled\b|shipped\b|installed\b|bumped\b|updated\b|already\b|up to date\b|nothing to)/i.test(detail)) return { state: 'succeeded', detail };
	return { state: 'unknown', detail };
}
