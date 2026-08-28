import { readdir } from 'node:fs/promises';
import path from 'node:path';

const FACTS_FILE = /^(APP|TOOL|SKILL)_FACTS\.md$/i;
const SKIP_DIRS = new Set(['node_modules', 'dist', '.git', '.svelte-kit', '.localhelm']);

function escapeRe(value: string): string {
	return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Rewrite package version in a facts label. Leaves `*_facts_version` alone. */
export function rewriteFactsVersion(text: string, from: string, to: string): string | null {
	if (!from || from === to) return null;
	const escaped = escapeRe(from);
	const next = text
		.replace(new RegExp(`(^|\\n)version:\\s*"${escaped}"`, 'g'), `$1version: "${to}"`)
		.replace(new RegExp(`(^|\\n)version:\\s*${escaped}(?=\\s|$)`, 'g'), `$1version: ${to}`)
		.replace(new RegExp(`\\| \\*\\*Version\\*\\* \\| ${escaped} \\|`, 'g'), `| **Version** | ${to} |`);
	return next === text ? null : next;
}

export async function listFactsFiles(root: string): Promise<string[]> {
	const found: string[] = [];
	async function walk(dir: string, depth: number): Promise<void> {
		if (depth > 8) return;
		let entries;
		try {
			entries = await readdir(dir, { withFileTypes: true });
		} catch {
			return;
		}
		for (const entry of entries) {
			if (SKIP_DIRS.has(entry.name)) continue;
			const full = path.join(dir, entry.name);
			if (entry.isDirectory()) await walk(full, depth + 1);
			else if (FACTS_FILE.test(entry.name)) found.push(full);
		}
	}
	await walk(root, 0);
	return found;
}
