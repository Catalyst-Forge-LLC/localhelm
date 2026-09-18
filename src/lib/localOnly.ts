import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { helmStateDir } from './demoMode.js';
import { toPosix } from './paths.js';

export const LOCAL_ONLY_FILE = 'local-only.json';

export type LocalOnlyFile = {
	version: 1;
	ids: string[];
	markedAt: Record<string, string>;
};

export function localOnlyPath(workspaceRoot: string): string {
	return toPosix(path.join(helmStateDir(workspaceRoot), LOCAL_ONLY_FILE));
}

function emptyFile(): LocalOnlyFile {
	return { version: 1, ids: [], markedAt: {} };
}

export async function readLocalOnly(workspaceRoot: string): Promise<LocalOnlyFile> {
	try {
		const raw = await readFile(localOnlyPath(workspaceRoot), 'utf8');
		const parsed = JSON.parse(raw) as { ids?: unknown; markedAt?: unknown };
		const ids = Array.isArray(parsed.ids)
			? parsed.ids.filter((id): id is string => typeof id === 'string' && Boolean(id.trim()))
			: [];
		const markedAt =
			parsed.markedAt && typeof parsed.markedAt === 'object' && !Array.isArray(parsed.markedAt)
				? Object.fromEntries(
						Object.entries(parsed.markedAt as Record<string, unknown>).filter(
							(entry): entry is [string, string] => typeof entry[1] === 'string',
						),
					)
				: {};
		return { version: 1, ids: [...new Set(ids)], markedAt };
	} catch (err) {
		const code = err && typeof err === 'object' && 'code' in err ? String((err as { code: unknown }).code) : '';
		if (code === 'ENOENT') return emptyFile();
		return emptyFile();
	}
}

async function writeLocalOnly(workspaceRoot: string, file: LocalOnlyFile): Promise<LocalOnlyFile> {
	await mkdir(path.dirname(localOnlyPath(workspaceRoot)), { recursive: true });
	const payload: LocalOnlyFile = {
		version: 1,
		ids: [...new Set(file.ids)].sort(),
		markedAt: file.markedAt,
	};
	await writeFile(localOnlyPath(workspaceRoot), `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
	return payload;
}

export async function markLocalOnly(workspaceRoot: string, ids: string[]): Promise<LocalOnlyFile> {
	const current = await readLocalOnly(workspaceRoot);
	const now = new Date().toISOString();
	const next = new Set(current.ids);
	const markedAt = { ...current.markedAt };
	for (const raw of ids) {
		const id = raw.trim();
		if (!id) continue;
		next.add(id);
		markedAt[id] = now;
	}
	return writeLocalOnly(workspaceRoot, { version: 1, ids: [...next], markedAt });
}

export async function clearLocalOnly(workspaceRoot: string, ids: string[]): Promise<LocalOnlyFile> {
	const current = await readLocalOnly(workspaceRoot);
	const drop = new Set(ids.map((id) => id.trim()).filter(Boolean));
	const markedAt = { ...current.markedAt };
	for (const id of drop) delete markedAt[id];
	return writeLocalOnly(workspaceRoot, {
		version: 1,
		ids: current.ids.filter((id) => !drop.has(id)),
		markedAt,
	});
}

export { localOnlyCoversId } from './localOnlyVis.js';
