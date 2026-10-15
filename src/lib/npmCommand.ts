import { existsSync, realpathSync } from 'node:fs';
import path from 'node:path';

/** Use npm's JS entry on Windows; shell concatenation breaks paths and expands metacharacters. */
export function npmInvocation(args: readonly string[]): { command: string; args: string[] } {
	const candidates: string[] = [];
	if (process.env.npm_execpath?.endsWith('npm-cli.js')) candidates.push(process.env.npm_execpath);
	const nodeDir = path.dirname(process.execPath);
	candidates.push(path.join(nodeDir, 'node_modules/npm/bin/npm-cli.js'), path.resolve(nodeDir, '../lib/node_modules/npm/bin/npm-cli.js'));
	for (const dir of (process.env.PATH ?? '').split(path.delimiter).filter(Boolean)) {
		for (const name of ['npm', 'npm.cmd']) {
			const executable = path.join(dir, name);
			if (!existsSync(executable)) continue;
			try { const real = realpathSync(executable); if (real.endsWith('npm-cli.js')) candidates.push(real); } catch { /* try adjacent installation */ }
			candidates.push(path.join(dir, 'node_modules/npm/bin/npm-cli.js'));
		}
	}
	const cli = candidates.find((candidate) => existsSync(candidate));
	if (cli) return { command: process.execPath, args: [cli, ...args] };
	if (process.platform !== 'win32') return { command: 'npm', args: [...args] };
	throw new Error('Cannot locate npm-cli.js. Repair the Node/npm installation before preparing a release.');
}
