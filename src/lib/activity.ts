import { mkdir, readFile, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { toPosix } from './paths.js';

export const ACTIVITY_LIMIT = 200;
export const ACTIVITY_FILE = 'activity.json';

export type ActivityEntry = {
	at: string;
	title: string;
	body: string;
};

type ActivityFile = {
	version: 1;
	entries: ActivityEntry[];
};

export function activityPath(workspaceRoot: string): string {
	return toPosix(path.join(workspaceRoot, '.localhelm', ACTIVITY_FILE));
}

function emptyFile(): ActivityFile {
	return { version: 1, entries: [] };
}

function asEntry(value: unknown): ActivityEntry | null {
	if (!value || typeof value !== 'object') return null;
	const row = value as { at?: unknown; title?: unknown; body?: unknown };
	if (typeof row.at !== 'string' || typeof row.title !== 'string' || typeof row.body !== 'string') {
		return null;
	}
	if (!row.at.trim() || !row.title.trim()) return null;
	return { at: row.at, title: row.title, body: row.body };
}

export async function readActivity(workspaceRoot: string): Promise<ActivityEntry[]> {
	const file = activityPath(workspaceRoot);
	try {
		const raw = await readFile(file, 'utf8');
		const parsed = JSON.parse(raw) as { entries?: unknown };
		if (!Array.isArray(parsed.entries)) return [];
		return parsed.entries.map(asEntry).filter((row): row is ActivityEntry => row !== null).slice(0, ACTIVITY_LIMIT);
	} catch (err) {
		const code = err && typeof err === 'object' && 'code' in err ? String((err as { code: unknown }).code) : '';
		if (code === 'ENOENT') return [];
		return [];
	}
}

async function writeActivity(workspaceRoot: string, entries: ActivityEntry[]): Promise<void> {
	const file = activityPath(workspaceRoot);
	await mkdir(path.dirname(file), { recursive: true });
	const payload: ActivityFile = { version: 1, entries: entries.slice(0, ACTIVITY_LIMIT) };
	await writeFile(file, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
}

export function activityBody(data: unknown): string {
	if (typeof data === 'string') return data;
	try {
		return JSON.stringify(data, null, 2);
	} catch {
		return String(data);
	}
}

export async function appendActivity(
	workspaceRoot: string,
	input: { title: string; body?: string; data?: unknown; at?: string },
): Promise<ActivityEntry[]> {
	const title = input.title.trim();
	if (!title) throw new Error('activity title is required');
	const entry: ActivityEntry = {
		at: input.at?.trim() || new Date().toISOString(),
		title,
		body: input.body ?? activityBody(input.data),
	};
	const entries = [entry, ...(await readActivity(workspaceRoot))].slice(0, ACTIVITY_LIMIT);
	await writeActivity(workspaceRoot, entries);
	return entries;
}

export async function clearActivity(workspaceRoot: string): Promise<void> {
	const file = activityPath(workspaceRoot);
	try {
		await unlink(file);
	} catch (err) {
		const code = err && typeof err === 'object' && 'code' in err ? String((err as { code: unknown }).code) : '';
		if (code !== 'ENOENT') throw err;
	}
}
