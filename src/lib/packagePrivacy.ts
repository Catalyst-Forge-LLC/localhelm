import { createHash } from 'node:crypto';
import { lstat, readFile, realpath, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { LoadedManifest } from './manifest.js';
import { joinRoot, toPosix } from './paths.js';
import { readReleaseTarget } from './releaseTarget.js';

export type PackagePrivacyPlan = {
	id: string;
	file?: string;
	name?: string;
	version?: string;
	from?: boolean;
	revision?: string;
	action: 'remove' | 'skip';
	reason?: string;
};

/** Locate only a top-level private value; leave nested fields and formatting intact. */
function privateRange(raw: string): { key: number; end: number } | undefined {
	let depth = 0;
	let found: { key: number; end: number } | undefined;
	for (let i = 0; i < raw.length; i++) {
		const char = raw[i];
		if (char === '"') {
			let end = i + 1;
			for (; end < raw.length; end++) {
				if (raw[end] === '\\') end++;
				else if (raw[end] === '"') break;
			}
			const colon = /^\s*:\s*/.exec(raw.slice(end + 1));
			if (depth === 1 && colon && JSON.parse(raw.slice(i, end + 1)) === 'private') {
				if (found) throw new Error('package.json has duplicate private fields. Resolve them before changing publishing.');
				const start = end + 1 + colon[0].length;
				const literal = /^(?:true|false)\b/.exec(raw.slice(start));
				if (!literal) throw new Error('package.json private must be a boolean.');
				found = { key: i, end: start + literal[0].length };
			}
			i = end;
		} else if (char === '{' || char === '[') depth++;
		else if (char === '}' || char === ']') depth--;
	}
	return found;
}

function removePrivate(raw: string): string {
	const range = privateRange(raw);
	if (!range) return raw;
	if (Object.keys(JSON.parse(raw) as object).length === 1) return raw.slice(0, raw.indexOf('{') + 1) + raw.slice(range.end);
	const nextComma = /^\s*,/.exec(raw.slice(range.end));
	if (nextComma) {
		const lineStart = raw.lastIndexOf('\n', range.key) + 1;
		const ownLine = /^[\t ]*$/.test(raw.slice(lineStart, range.key));
		let end = range.end + nextComma[0].length;
		if (ownLine) end += /^[\t ]*\r?\n/.exec(raw.slice(end))?.[0].length ?? 0;
		return raw.slice(0, ownLine ? lineStart : range.key) + raw.slice(end);
	}
	const previousComma = /,\s*$/.exec(raw.slice(0, range.key));
	if (!previousComma) throw new Error('Could not locate the private field safely.');
	return raw.slice(0, previousComma.index) + raw.slice(range.end);
}

async function inspectPackage(loaded: LoadedManifest, id: string): Promise<{ plan: PackagePrivacyPlan; raw?: string }> {
	const project = loaded.manifest.projects.find((row) => row.id === id);
	if (!project) return { plan: { id, action: 'skip', reason: `not enrolled: ${id}` } };
	try {
		const directory = await realpath(joinRoot(loaded.workspaceRoot, project.path));
		const file = (await readReleaseTarget(directory))?.target.manifest ?? path.join(directory, 'package.json');
		const stat = await lstat(file);
		if (!stat.isFile() || stat.isSymbolicLink()) throw new Error('package.json must be a regular file, not a link.');
		const raw = await readFile(file, 'utf8');
		const pkg: unknown = JSON.parse(raw);
		if (!pkg || typeof pkg !== 'object' || Array.isArray(pkg)) throw new Error('package.json must contain an object.');
		const data = pkg as Record<string, unknown>;
		privateRange(raw);
		const from = data.private === true;
		return {
			raw,
			plan: {
				id, file: toPosix(file), from,
				name: typeof data.name === 'string' ? data.name : undefined,
				version: typeof data.version === 'string' ? data.version : undefined,
				revision: createHash('sha256').update(raw).digest('hex'),
				action: from ? 'remove' : 'skip',
				...(!from ? { reason: 'npm publishing is already allowed' } : {}),
			},
		};
	} catch (err) {
		return { plan: { id, action: 'skip', reason: err instanceof Error ? err.message : String(err) } };
	}
}

export async function planPackagePrivacy(loaded: LoadedManifest, id: string): Promise<PackagePrivacyPlan> {
	return (await inspectPackage(loaded, id)).plan;
}

/** Bind apply to the confirmed enrolled file and its exact pre-edit contents. */
export async function applyPackagePrivacy(
	loaded: LoadedManifest, id: string, expectedFile: string, expectedRevision: string,
): Promise<PackagePrivacyPlan & { writes: boolean }> {
	const { plan, raw } = await inspectPackage(loaded, id);
	if (!plan.file || plan.file !== expectedFile || !plan.revision || plan.revision !== expectedRevision || raw === undefined) {
		throw new Error('The package changed or is unavailable. Open a new publishing confirmation.');
	}
	if (plan.action !== 'remove') return { ...plan, writes: false };
	await writeFile(plan.file, removePrivate(raw), 'utf8');
	return { ...plan, writes: true };
}
