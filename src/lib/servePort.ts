import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { createServer } from 'node:net';

export type PortOccupant = { pid: number; command?: string };

export function parseNetstatListeningPids(raw: string, port: number): number[] {
	const pids = new Set<number>();
	const needle = `:${port}`;
	for (const line of raw.split(/\r?\n/)) {
		if (!/LISTENING/i.test(line)) continue;
		const idx = line.indexOf(needle);
		if (idx < 0) continue;
		const after = line[idx + needle.length];
		if (after && after !== ' ' && after !== '\t') continue;
		const pid = Number(line.trim().split(/\s+/).at(-1));
		if (Number.isInteger(pid) && pid > 0) pids.add(pid);
	}
	return [...pids];
}

export function parseLsofListeningPids(raw: string, port: number): number[] {
	const pids = new Set<number>();
	const listen = new RegExp(`:${port}\\s+\\(LISTEN\\)`);
	for (const line of raw.split(/\r?\n/)) {
		if (!listen.test(line)) continue;
		const parts = line.trim().split(/\s+/);
		const pid = Number(parts[1]);
		if (Number.isInteger(pid) && pid > 0) pids.add(pid);
	}
	return [...pids];
}

function tidyCommand(raw: string): string {
	return raw.replace(/\s+/g, ' ').trim().slice(0, 240);
}

export function portBusyMessage(port: number, occupants: readonly PortOccupant[]): string {
	if (!occupants.length) {
		return `${port} is already in use. LocalHelm could not name the process. Stop it yourself, then serve. Re-run with --free-port only after a pid is listed.`;
	}
	const who = occupants
		.map((row) => {
			const cmd = row.command ? `\n  ${tidyCommand(row.command)}` : '';
			return `  pid ${row.pid}${cmd}`;
		})
		.join('\n');
	const those = occupants.length === 1 ? 'that process' : 'those processes';
	return `${port} is already in use\n${who}\n\nNothing stopped. Re-run with --free-port to stop ${those} and serve.`;
}

export function probeListen(host: string, port: number): Promise<boolean> {
	return new Promise((resolve) => {
		const server = createServer();
		const done = (ok: boolean): void => {
			server.removeAllListeners();
			try {
				server.close();
			} catch {
				/* already closed */
			}
			resolve(ok);
		};
		server.once('error', () => done(false));
		try {
			server.listen({ host, port, exclusive: true }, () => done(true));
		} catch {
			done(false);
		}
	});
}

function netstatPids(port: number): number[] {
	const result = spawnSync('netstat', ['-ano', '-p', 'TCP'], {
		encoding: 'utf8',
		windowsHide: true,
	});
	return parseNetstatListeningPids(result.stdout ?? '', port);
}

function lsofPids(port: number): number[] {
	const result = spawnSync('lsof', ['-nP', `-iTCP:${port}`, '-sTCP:LISTEN'], {
		encoding: 'utf8',
		windowsHide: true,
	});
	if (result.status === 0 || (result.stdout ?? '').trim()) {
		return parseLsofListeningPids(result.stdout ?? '', port);
	}
	return [];
}

function windowsCommandLine(pid: number): string | undefined {
	const result = spawnSync(
		'powershell.exe',
		[
			'-NoProfile',
			'-Command',
			`Get-CimInstance Win32_Process -Filter "ProcessId=${pid}" | Select-Object -ExpandProperty CommandLine`,
		],
		{ encoding: 'utf8', windowsHide: true },
	);
	const line = (result.stdout ?? '').trim();
	return line || undefined;
}

function unixCommandLine(pid: number): string | undefined {
	try {
		const raw = readFileSync(`/proc/${pid}/cmdline`, 'utf8').replace(/\0/g, ' ').trim();
		if (raw) return raw;
	} catch {
		/* macOS has no /proc */
	}
	const result = spawnSync('ps', ['-p', String(pid), '-o', 'args='], {
		encoding: 'utf8',
		windowsHide: true,
	});
	const line = (result.stdout ?? '').trim();
	return line || undefined;
}

export function findPortOccupants(port: number): PortOccupant[] {
	const pids = process.platform === 'win32' ? netstatPids(port) : lsofPids(port);
	return pids
		.filter((pid) => pid !== process.pid)
		.map((pid) => ({
			pid,
			command: process.platform === 'win32' ? windowsCommandLine(pid) : unixCommandLine(pid),
		}));
}

export function stopPortOccupant(pid: number): void {
	if (!Number.isInteger(pid) || pid <= 1 || pid === process.pid) {
		throw new Error(`refusing to stop pid ${pid}`);
	}
	if (process.platform === 'win32') {
		const result = spawnSync('taskkill.exe', ['/PID', String(pid), '/T', '/F'], {
			encoding: 'utf8',
			windowsHide: true,
		});
		if (result.status !== 0) {
			const err = (result.stderr || result.stdout || 'taskkill failed').trim().split(/\r?\n/).find(Boolean);
			throw new Error(err ?? 'taskkill failed');
		}
		return;
	}
	try {
		process.kill(pid, 'SIGTERM');
	} catch (err) {
		throw new Error(err instanceof Error ? err.message : String(err));
	}
}

function wait(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function ensureServePort(
	host: string,
	port: number,
	freePort: boolean,
): Promise<{ freed: PortOccupant[] }> {
	if (await probeListen(host, port)) return { freed: [] };
	const occupants = findPortOccupants(port);
	if (!freePort) throw new Error(portBusyMessage(port, occupants));
	if (!occupants.length) {
		throw new Error(
			`${port} is in use but LocalHelm could not name a process. Stop it yourself, then serve. Never --force.`,
		);
	}
	for (const row of occupants) stopPortOccupant(row.pid);
	await wait(400);
	if (await probeListen(host, port)) return { freed: occupants };
	const still = findPortOccupants(port);
	throw new Error(
		still.length
			? `${port} is still in use after --free-port\n${still
					.map((row) => `  pid ${row.pid}${row.command ? `\n  ${tidyCommand(row.command)}` : ''}`)
					.join('\n')}`
			: `${port} is still in use after --free-port`,
	);
}
