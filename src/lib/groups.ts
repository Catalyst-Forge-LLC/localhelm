import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { helmStateDir } from './demoMode.js';
import { sameGroupName, type SelectionGroup } from './groupSelect.js';
import { toPosix } from './paths.js';

export const GROUPS_FILE = 'groups.json';
const NAME_MAX = 48;
const IDS_MAX = 200;

export type GroupsFile = {
	version: 1;
	groups: SelectionGroup[];
};

export function groupsPath(workspaceRoot: string): string {
	return toPosix(path.join(helmStateDir(workspaceRoot), GROUPS_FILE));
}

function emptyFile(): GroupsFile {
	return { version: 1, groups: [] };
}

function cleanName(raw: string): string {
	const name = raw.trim().replace(/\s+/g, ' ');
	if (!name) throw new Error('Name the group.');
	if (name.length > NAME_MAX) throw new Error(`Group name must be ${NAME_MAX} characters or fewer.`);
	if (/[\u0000-\u001f]/.test(name)) throw new Error('Group name cannot include a line break.');
	return name;
}

function cleanIds(raw: readonly string[]): string[] {
	const seen = new Set<string>();
	const ids: string[] = [];
	for (const item of raw) {
		const id = item.trim();
		if (!id || seen.has(id)) continue;
		seen.add(id);
		ids.push(id);
	}
	if (!ids.length) throw new Error('Check at least one row before saving a group.');
	if (ids.length > IDS_MAX) throw new Error(`A group can hold ${IDS_MAX} rows.`);
	return ids.sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
}

export async function readGroups(workspaceRoot: string): Promise<GroupsFile> {
	let raw: string;
	try {
		raw = await readFile(groupsPath(workspaceRoot), 'utf8');
	} catch (err) {
		const code = err && typeof err === 'object' && 'code' in err ? String((err as { code: unknown }).code) : '';
		if (code === 'ENOENT') return emptyFile();
		throw new Error(`Could not read groups.json (${code || 'read failed'}).`);
	}
	let parsed: unknown;
	try {
		parsed = JSON.parse(raw);
	} catch {
		throw new Error('groups.json is not valid JSON. Fix or remove that file before saving a group.');
	}
	if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
		throw new Error('groups.json is not valid JSON. Fix or remove that file before saving a group.');
	}
	const list = (parsed as { groups?: unknown }).groups;
	if (!Array.isArray(list)) return emptyFile();
	const groups: SelectionGroup[] = [];
	for (const item of list) {
		if (!item || typeof item !== 'object' || Array.isArray(item)) continue;
		const rec = item as { name?: unknown; ids?: unknown };
		if (typeof rec.name !== 'string' || !rec.name.trim()) continue;
		const ids = Array.isArray(rec.ids) ? rec.ids.filter((id): id is string => typeof id === 'string' && Boolean(id.trim())) : [];
		if (!ids.length) continue;
		groups.push({ name: rec.name.trim(), ids: [...new Set(ids)].sort() });
	}
	groups.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
	return { version: 1, groups };
}

async function writeGroups(workspaceRoot: string, file: GroupsFile): Promise<GroupsFile> {
	await mkdir(path.dirname(groupsPath(workspaceRoot)), { recursive: true });
	await writeFile(groupsPath(workspaceRoot), `${JSON.stringify(file, null, 2)}\n`, 'utf8');
	return file;
}

export async function saveGroup(workspaceRoot: string, name: string, ids: readonly string[]): Promise<GroupsFile> {
	const label = cleanName(name);
	const nextIds = cleanIds(ids);
	const current = await readGroups(workspaceRoot);
	const groups = current.groups.filter((group) => !sameGroupName(group.name, label));
	groups.push({ name: label, ids: nextIds });
	groups.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
	return writeGroups(workspaceRoot, { version: 1, groups });
}

export async function deleteGroup(workspaceRoot: string, name: string): Promise<GroupsFile> {
	const label = cleanName(name);
	const current = await readGroups(workspaceRoot);
	const groups = current.groups.filter((group) => !sameGroupName(group.name, label));
	if (groups.length === current.groups.length) throw new Error(`No group named ${label}.`);
	return writeGroups(workspaceRoot, { version: 1, groups });
}
