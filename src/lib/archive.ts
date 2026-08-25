import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { toPosix } from './paths.js';

export const ARCHIVE_FILE = 'archive.json';

export type ArchiveFile = {
	version: 1;
	ids: string[];
	archivedAt: Record<string, string>;
};

export function archivePath(workspaceRoot: string): string {
	return toPosix(path.join(workspaceRoot, '.localhelm', ARCHIVE_FILE));
}

function emptyFile(): ArchiveFile {
	return { version: 1, ids: [], archivedAt: {} };
}

export async function readArchive(workspaceRoot: string): Promise<ArchiveFile> {
	try {
		const raw = await readFile(archivePath(workspaceRoot), 'utf8');
		const parsed = JSON.parse(raw) as { ids?: unknown; archivedAt?: unknown };
		const ids = Array.isArray(parsed.ids)
			? parsed.ids.filter((id): id is string => typeof id === 'string' && Boolean(id.trim()))
			: [];
		const archivedAt =
			parsed.archivedAt && typeof parsed.archivedAt === 'object' && !Array.isArray(parsed.archivedAt)
				? Object.fromEntries(
						Object.entries(parsed.archivedAt as Record<string, unknown>).filter(
							(entry): entry is [string, string] => typeof entry[1] === 'string',
						),
					)
				: {};
		return { version: 1, ids: [...new Set(ids)], archivedAt };
	} catch (err) {
		const code = err && typeof err === 'object' && 'code' in err ? String((err as { code: unknown }).code) : '';
		if (code === 'ENOENT') return emptyFile();
		return emptyFile();
	}
}

async function writeArchive(workspaceRoot: string, file: ArchiveFile): Promise<ArchiveFile> {
	await mkdir(path.dirname(archivePath(workspaceRoot)), { recursive: true });
	const payload: ArchiveFile = {
		version: 1,
		ids: [...new Set(file.ids)].sort(),
		archivedAt: file.archivedAt,
	};
	await writeFile(archivePath(workspaceRoot), `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
	return payload;
}

export async function archiveIds(workspaceRoot: string, ids: string[]): Promise<ArchiveFile> {
	const current = await readArchive(workspaceRoot);
	const now = new Date().toISOString();
	const next = new Set(current.ids);
	const archivedAt = { ...current.archivedAt };
	for (const raw of ids) {
		const id = raw.trim();
		if (!id) continue;
		next.add(id);
		archivedAt[id] = now;
	}
	return writeArchive(workspaceRoot, { version: 1, ids: [...next], archivedAt });
}

export async function restoreIds(workspaceRoot: string, ids: string[]): Promise<ArchiveFile> {
	const current = await readArchive(workspaceRoot);
	const drop = new Set(ids.map((id) => id.trim()).filter(Boolean));
	const archivedAt = { ...current.archivedAt };
	for (const id of drop) delete archivedAt[id];
	return writeArchive(workspaceRoot, {
		version: 1,
		ids: current.ids.filter((id) => !drop.has(id)),
		archivedAt,
	});
}

export function isArchived(id: string, archived: Iterable<string>): boolean {
	return new Set(archived).has(id);
}
