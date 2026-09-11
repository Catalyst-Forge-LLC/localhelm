import assert from 'node:assert/strict';
import { createServer } from 'node:net';
import { describe, it } from 'node:test';
import { parseLsofListeningPids, parseNetstatListeningPids, portBusyMessage, probeListen } from './servePort.js';

describe('parseNetstatListeningPids', () => {
	it('reads IPv4 and IPv6 listeners and ignores other ports', () => {
		const raw = [
			'  TCP    0.0.0.0:4321           0.0.0.0:0              LISTENING       32324',
			'  TCP    [::]:4321              [::]:0                 LISTENING       32324',
			'  TCP    127.0.0.1:4321         127.0.0.1:24290        ESTABLISHED     32324',
			'  TCP    0.0.0.0:14321          0.0.0.0:0              LISTENING       99',
			'  TCP    0.0.0.0:43210          0.0.0.0:0              LISTENING       100',
		].join('\n');
		assert.deepEqual(parseNetstatListeningPids(raw, 4321), [32324]);
	});
});

describe('parseLsofListeningPids', () => {
	it('reads LISTEN rows for that port only', () => {
		const raw = [
			'COMMAND   PID USER   FD   TYPE DEVICE SIZE/OFF NODE NAME',
			'node    32324 acme   23u  IPv4 0x1      0t0  TCP *:4321 (LISTEN)',
			'node    11111 acme   24u  IPv4 0x2      0t0  TCP *:14321 (LISTEN)',
			'node    22222 acme   25u  IPv4 0x3      0t0  TCP 127.0.0.1:4321 (ESTABLISHED)',
		].join('\n');
		assert.deepEqual(parseLsofListeningPids(raw, 4321), [32324]);
	});
});

describe('portBusyMessage', () => {
	it('names the pid and asks for --free-port', () => {
		const text = portBusyMessage(4321, [
			{ pid: 32324, command: 'node   vite.js   dev --port 4321' },
		]);
		assert.match(text, /4321 is already in use/);
		assert.match(text, /pid 32324/);
		assert.match(text, /node vite\.js dev --port 4321/);
		assert.match(text, /Nothing stopped/);
		assert.match(text, /--free-port/);
		assert.equal(portBusyMessage(4321, []).includes('could not name'), true);
	});
});

describe('probeListen', () => {
	it('is false while this process holds the port, then true after close', async () => {
		const held = createServer();
		const port = await new Promise<number>((resolve, reject) => {
			held.once('error', reject);
			held.listen({ host: '127.0.0.1', port: 0, exclusive: true }, () => {
				const addr = held.address();
				if (!addr || typeof addr === 'string') reject(new Error('no port'));
				else resolve(addr.port);
			});
		});
		assert.equal(await probeListen('127.0.0.1', port), false);
		await new Promise<void>((resolve) => held.close(() => resolve()));
		assert.equal(await probeListen('127.0.0.1', port), true);
	});
});
