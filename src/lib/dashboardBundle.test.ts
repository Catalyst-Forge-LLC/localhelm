import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import { npmBareImports } from './dashboardBundle.js';

describe('npmBareImports', () => {
	it('keeps node and relative, flags a package', () => {
		assert.deepEqual(
			npmBareImports(
				`import http from 'node:http';\nimport { x } from './chunk.js';\nimport { icons } from '@iconify-json/lucide';\n/** @import { Fork } from 'svelte' */\n`,
			),
			['@iconify-json/lucide'],
		);
	});
});

describe('packaged dashboard', () => {
	it('does not import npm packages the global install will not have', () => {
		const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
		const dir = path.join(root, 'dashboard');
		let files: string[] = [];
		try {
			files = listJs(dir);
		} catch {
			return;
		}
		if (!files.length) return;
		const bare = new Set<string>();
		for (const file of files) {
			for (const spec of npmBareImports(readFileSync(file, 'utf8'))) bare.add(spec);
		}
		assert.deepEqual(
			[...bare],
			[],
			`dashboard/ still imports ${[...bare].join(', ')}. Bundle it (vite ssr.noExternal) so pnpm i -g localhelm can serve.`,
		);
	});
});

function listJs(dir: string): string[] {
	const out: string[] = [];
	for (const entry of readdirSync(dir, { withFileTypes: true })) {
		const full = path.join(dir, entry.name);
		if (entry.isDirectory()) out.push(...listJs(full));
		else if (entry.name.endsWith('.js')) out.push(full);
	}
	return out;
}
