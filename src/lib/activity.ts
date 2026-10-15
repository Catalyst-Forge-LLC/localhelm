import { createHash, randomUUID } from 'node:crypto';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { helmStateDir } from './demoMode.js';
import { toPosix } from './paths.js';
import { acquireJobLock } from './lock.js';

export const ACTIVITY_LIMIT = 200;
export const ACTIVITY_FILE = 'activity.json';
export type ActivityEntry = { id?: string; at: string; title: string; body: string };
export type ActivitySnapshot = { generation: string; entries: ActivityEntry[] };
type ActivityFile = ActivitySnapshot & { version: 1; seen: Record<string, string> };
const queues = new Map<string, Promise<unknown>>();
export function activityPath(workspaceRoot: string): string { return toPosix(path.join(helmStateDir(workspaceRoot), ACTIVITY_FILE)); }
const emptyFile = (): ActivityFile => ({ version: 1, generation: '0', entries: [], seen: {} });
function asEntry(value: unknown): ActivityEntry | null {
	if (!value || typeof value !== 'object') return null;
	const row = value as ActivityEntry;
	if (typeof row.at !== 'string' || !row.at.trim() || typeof row.title !== 'string' || !row.title.trim() || typeof row.body !== 'string') return null;
	return { ...(typeof row.id === 'string' ? { id: row.id } : {}), at: row.at, title: row.title, body: row.body };
}
async function readFileState(file: string): Promise<ActivityFile> {
	try {
		const parsed = JSON.parse(await readFile(file, 'utf8')) as Partial<ActivityFile>;
		if (parsed.version !== 1 || !Array.isArray(parsed.entries)) throw new Error('Invalid Activity file. Preserve it before clearing Activity.');
		return { version: 1, generation: typeof parsed.generation === 'string' ? parsed.generation : '0', entries: parsed.entries.map(asEntry).filter((row): row is ActivityEntry => row !== null).slice(0, ACTIVITY_LIMIT), seen: parsed.seen && typeof parsed.seen === 'object' ? parsed.seen : {} };
	} catch (err) { if ((err as NodeJS.ErrnoException).code === 'ENOENT') return emptyFile(); throw err; }
}
async function serialize<T>(file: string, fn: () => Promise<T>): Promise<T> {
	const key = process.platform === 'win32' ? file.toLowerCase() : file;
	const previous = queues.get(key) ?? Promise.resolve();
	const task = previous.catch(() => undefined).then(fn); queues.set(key, task);
	try { return await task; } finally { if (queues.get(key) === task) queues.delete(key); }
}
async function writeState(file: string, state: ActivityFile): Promise<void> {
	await mkdir(path.dirname(file), { recursive: true });
	const temporary = `${file}.${randomUUID()}.tmp`;
	await writeFile(temporary, JSON.stringify(state, null, 2) + '\n', { encoding: 'utf8', flag: 'wx' });
	await rename(temporary, file);
}
async function mutate<T>(root: string, file: string, fn: () => Promise<T>): Promise<T> {
	return serialize(file, async () => { const lock = await acquireJobLock(root); try { return await fn(); } finally { await lock.release(); } });
}
export async function readActivitySnapshot(workspaceRoot: string): Promise<ActivitySnapshot> {
	const file = activityPath(workspaceRoot); return serialize(file, async () => { const state = await readFileState(file); return { generation: state.generation, entries: state.entries }; });
}
/** Legacy read API remains tolerant; dashboard uses the strict snapshot API. */
export async function readActivity(workspaceRoot: string): Promise<ActivityEntry[]> { try { return (await readActivitySnapshot(workspaceRoot)).entries; } catch { return []; } }
export function activityBody(data: unknown): string { if (typeof data === 'string') return data; try { return JSON.stringify(data, null, 2) ?? ''; } catch { return String(data); } }
export async function appendActivitySnapshot(workspaceRoot: string, input: { id?: string; title: string; body?: string; data?: unknown; at?: string; generation?: string }): Promise<ActivitySnapshot> {
	const title = input.title.trim(); if (!title) throw new Error('activity title is required');
	if (input.id && !input.generation) throw new Error('Activity generation is required with a client ID. Refresh Activity.');
	if (input.id && (!input.at || !Number.isFinite(Date.parse(input.at)))) throw new Error('Client Activity requires its original timestamp.');
	const entry: ActivityEntry = { ...(input.id ? { id: input.id } : {}), at: input.at?.trim() || new Date().toISOString(), title, body: input.body ?? activityBody(input.data) };
	const file = activityPath(workspaceRoot);
	return mutate(workspaceRoot, file, async () => {
		const state = await readFileState(file);
		if (input.generation && input.generation !== state.generation) throw new Error('Activity was cleared in another session. Review the queued entries before saving them.');
		const digest = createHash('sha256').update(JSON.stringify(entry)).digest('hex');
		const existing = entry.id ? state.entries.find((row) => row.id === entry.id) : undefined;
		if (existing) { if (createHash('sha256').update(JSON.stringify(existing)).digest('hex') !== digest) throw new Error('Activity ID already belongs to different content.'); return { generation: state.generation, entries: state.entries }; }
		if (entry.id && Object.hasOwn(state.seen, entry.id)) { if (state.seen[entry.id] !== digest) throw new Error('Activity ID already belongs to different content.'); return { generation: state.generation, entries: state.entries }; }
		if (entry.id) state.seen[entry.id] = digest;
		state.entries = [entry, ...state.entries].sort((a, b) => b.at.localeCompare(a.at)).slice(0, ACTIVITY_LIMIT);
		const seen = Object.entries(state.seen); state.seen = Object.fromEntries(seen.slice(-2000));
		await writeState(file, state); return { generation: state.generation, entries: state.entries };
	});
}
export async function appendActivity(workspaceRoot: string, input: Parameters<typeof appendActivitySnapshot>[1]): Promise<ActivityEntry[]> { return (await appendActivitySnapshot(workspaceRoot, input)).entries; }
export async function clearActivity(workspaceRoot: string, expectedGeneration?: string): Promise<ActivitySnapshot> {
	const file = activityPath(workspaceRoot);
	return mutate(workspaceRoot, file, async () => {
		let state: ActivityFile; try { state = await readFileState(file); } catch (err) { if (expectedGeneration) throw err; state = emptyFile(); }
		if (expectedGeneration && state.generation !== expectedGeneration) throw new Error('Activity changed before Clear. Refresh and review it.');
		const cleared = { ...emptyFile(), generation: randomUUID() }; await writeState(file, cleared); return { generation: cleared.generation, entries: [] };
	});
}
