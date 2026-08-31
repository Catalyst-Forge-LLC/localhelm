import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
	isLoopbackClient,
	isOperatorFace,
	visitorFaviconHost,
	visitorHttpUrl,
	visitorPageHost,
	visitorTileLetter,
} from './loopback.js';

describe('loopback face', () => {
	it('treats the whole 127/8 as a loopback client', () => {
		assert.equal(isLoopbackClient('127.0.0.1'), true);
		assert.equal(isLoopbackClient('127.1.2.3'), true);
		assert.equal(isLoopbackClient('::1'), true);
		assert.equal(isLoopbackClient('192.168.1.9'), false);
		assert.equal(isLoopbackClient('100.64.1.2'), false);
	});

	it('keeps the operator board on loopback Host and the Deck on LAN Host', () => {
		assert.equal(isOperatorFace('127.0.0.1', '127.0.0.1:4321'), true);
		assert.equal(isOperatorFace('127.0.0.1', 'localhost:4321'), true);
		assert.equal(isOperatorFace('127.0.0.1', '100.64.1.2:4321'), false);
		assert.equal(isOperatorFace('192.168.1.9', '192.168.1.9:4321'), false);
		assert.equal(isOperatorFace('100.64.1.2', 'mycroftone.tail1234.ts.net:4321'), false);
	});

	it('rewrites Open links onto the Host the phone already typed', () => {
		assert.equal(visitorPageHost('100.64.1.2:4321'), '100.64.1.2');
		assert.equal(visitorPageHost('mycroftone.tail1234.ts.net:4321'), 'mycroftone.tail1234.ts.net');
		assert.equal(visitorHttpUrl('100.64.1.2', 5201), 'http://100.64.1.2:5201/');
		assert.equal(
			visitorHttpUrl('mycroftone.tail1234.ts.net', 5201),
			'http://mycroftone.tail1234.ts.net:5201/',
		);
		assert.equal(visitorTileLetter('localhelm-site'), 'L');
	});

	it('loads favicons from a LAN IP when Open is a MagicDNS name', () => {
		assert.equal(visitorFaviconHost('127.0.0.1', ['100.64.1.2']), '127.0.0.1');
		assert.equal(
			visitorFaviconHost('mycroftone.tail1234.ts.net', ['100.74.12.14', '192.168.1.244']),
			'100.74.12.14',
		);
		assert.equal(visitorFaviconHost('100.64.1.2', ['192.168.1.244']), '100.64.1.2');
	});
});
