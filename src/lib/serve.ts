import { spawn, spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const DEFAULT_DASHBOARD_PORT = 54322;

function packageRoot(): string {
	return path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
}

function tryLocalBerthPort(): number | null {
	const result = spawnSync('localberth', ['get', 'localhelm'], {
		encoding: 'utf8',
		windowsHide: true,
	});
	if (result.status !== 0) return null;
	const n = Number((result.stdout ?? '').trim());
	return Number.isFinite(n) && n > 0 ? n : null;
}

export async function serveDashboard(opts: { host?: string; port?: number } = {}): Promise<void> {
	const host = opts.host ?? '127.0.0.1';
	if (host !== '127.0.0.1' && host !== 'localhost') {
		console.error(`warning: binding ${host} is opt-in; dashboard has no auth`);
	}
	const port = opts.port ?? tryLocalBerthPort() ?? DEFAULT_DASHBOARD_PORT;
	const appDir = path.join(packageRoot(), 'app');
	if (!existsSync(path.join(appDir, 'package.json'))) {
		throw new Error(`dashboard app missing at ${appDir}. From the localhelm checkout run pnpm --dir app install`);
	}
	const child = spawn(
		process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm',
		['--dir', appDir, 'exec', 'vite', 'dev', '--host', host, '--port', String(port), '--strictPort'],
		{
			stdio: 'inherit',
			windowsHide: true,
			shell: process.platform === 'win32',
			env: { ...process.env, LOCALHELM_CWD: process.cwd() },
		},
	);
	console.error(`localhelm serve  http://${host}:${port}`);
	await new Promise<void>((resolve, reject) => {
		child.on('exit', (code) => {
			if (code === 0 || code === null) resolve();
			else reject(new Error(`dashboard exited ${code}`));
		});
		child.on('error', reject);
	});
}
