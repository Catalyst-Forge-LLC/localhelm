import { spawn, spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const DEFAULT_DASHBOARD_PORT = 4321;
export const DEFAULT_DASHBOARD_HOST = '0.0.0.0';

export function packageRoot(): string {
	return path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
}

export type DashboardStart =
	| { mode: 'dev'; appDir: string }
	| { mode: 'built'; entry: string };

/** Checkout keeps Vite. A published install ships `dashboard/` (no `app/`). */
export function resolveDashboard(root: string): DashboardStart {
	const appDir = path.join(root, 'app');
	if (existsSync(path.join(appDir, 'package.json'))) return { mode: 'dev', appDir };
	const entry = path.join(root, 'dashboard', 'index.js');
	if (existsSync(entry)) return { mode: 'built', entry };
	throw new Error(
		`dashboard missing at ${root}. This install has no app/ and no built dashboard/. Run \`pnpm serve\` from a localhelm checkout, or install a release that ships dashboard/.`,
	);
}

function tryLeasePort(bin: string): number | null {
	const result = spawnSync(bin, ['get', 'localhelm'], {
		encoding: 'utf8',
		windowsHide: true,
		shell: process.platform === 'win32',
	});
	if (result.status !== 0) return null;
	const n = Number((result.stdout ?? '').trim());
	return Number.isFinite(n) && n > 0 ? n : null;
}

export type PortSource = 'flag' | 'localslip' | 'default';

function choosePort(requested?: number): { port: number; source: PortSource } {
	if (requested) return { port: requested, source: 'flag' };
	const leased = tryLeasePort('localslip') ?? tryLeasePort('localberth');
	if (leased) return { port: leased, source: 'localslip' };
	return { port: DEFAULT_DASHBOARD_PORT, source: 'default' };
}

function serveEnv(host: string, port: number, source: PortSource): NodeJS.ProcessEnv {
	const origin =
		host === '0.0.0.0' || host === '::' ? `http://127.0.0.1:${port}` : `http://${host}:${port}`;
	return {
		...process.env,
		HOST: host,
		PORT: String(port),
		ORIGIN: origin,
		LOCALHELM_CWD: process.cwd(),
		LOCALHELM_HOST: host,
		LOCALHELM_PORT: String(port),
		LOCALHELM_PORT_SOURCE: source,
	};
}

export async function serveDashboard(opts: { host?: string; port?: number } = {}): Promise<void> {
	const host = opts.host ?? DEFAULT_DASHBOARD_HOST;
	const { port, source } = choosePort(opts.port);
	const dash = resolveDashboard(packageRoot());
	const env = serveEnv(host, port, source);
	const child =
		dash.mode === 'dev'
			? spawn(
					process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm',
					['--dir', dash.appDir, 'exec', 'vite', 'dev', '--host', host, '--port', String(port), '--strictPort'],
					{ stdio: 'inherit', windowsHide: true, shell: process.platform === 'win32', env },
				)
			: spawn(process.execPath, [dash.entry], {
					stdio: 'inherit',
					windowsHide: true,
					env,
				});
	const how = source === 'localslip' ? ' (LocalSlip lease)' : source === 'flag' ? ' (--port)' : '';
	const where =
		host === '0.0.0.0' || host === '::'
			? `http://127.0.0.1:${port}${how}  (all interfaces)`
			: `http://${host}:${port}${how}`;
	console.error(`localhelm serve  ${where}${dash.mode === 'built' ? '  (packaged)' : ''}`);
	await new Promise<void>((resolve, reject) => {
		child.on('exit', (code) => {
			if (code === 0 || code === null) resolve();
			else reject(new Error(`dashboard exited ${code}`));
		});
		child.on('error', reject);
	});
}
