import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
	isLoopbackClient,
	isOperatorFace,
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

	it('keeps the operator board on loopback Host and the visitor face on LAN Host', () => {
		assert.equal(isOperatorFace('127.0.0.1', '127.0.0.1:4321'), true);
		assert.equal(isOperatorFace('127.0.0.1', 'localhost:4321'), true);
		assert.equal(isOperatorFace('127.0.0.1', '100.64.1.2:4321'), false);
		assert.equal(isOperatorFace('192.168.1.9', '192.168.1.9:4321'), false);
	});

	it('rewrites Open links onto the Host the phone already typed', () => {
		assert.equal(visitorPageHost('100.64.1.2:4321'), '100.64.1.2');
		assert.equal(visitorHttpUrl('100.64.1.2', 5201), 'http://100.64.1.2:5201/');
		assert.equal(visitorTileLetter('localhelm-site'), 'L');
	});
});
