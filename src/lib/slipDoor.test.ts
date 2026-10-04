import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { proxySlipOpen, slipUpstreamUrl } from './slipDoor.js';

describe('slipUpstreamUrl', () => {
	it('asks the LocalSlip dashboard and keeps the path', () => {
		assert.equal(slipUpstreamUrl('/s/engram/imports', '?tab=1'), 'http://127.0.0.1:54321/s/engram/imports?tab=1');
	});
});

describe('proxySlipOpen', () => {
	it('returns the redirect LocalSlip chose, on the host we forwarded', async () => {
		let seenHost = '';
		const res = await proxySlipOpen(
			{ pathname: '/s/engram', search: '', host: '100.74.12.14:4321', method: 'GET' },
			(async (url, init) => {
				seenHost = new Headers(init?.headers).get('host') ?? '';
				assert.equal(String(url), 'http://127.0.0.1:54321/s/engram');
				return new Response(null, {
					status: 302,
					headers: { location: 'http://100.74.12.14:5193/' }
				});
			}) as typeof fetch
		);
		assert.equal(seenHost, '100.74.12.14:4321');
		assert.equal(res.status, 302);
		assert.equal(res.headers.get('location'), 'http://100.74.12.14:5193/');
	});

	it('shows a page when LocalSlip is not answering', async () => {
		const res = await proxySlipOpen(
			{ pathname: '/s/engram', search: '', host: 'localhost:4321', method: 'GET' },
			(async () => {
				throw new Error('connect ECONNREFUSED');
			}) as typeof fetch
		);
		assert.equal(res.status, 503);
		assert.match(await res.text(), /LocalSlip is not up/);
	});
});
