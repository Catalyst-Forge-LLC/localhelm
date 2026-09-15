import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { formatActivityAt } from './formatTime.js';

describe('formatActivityAt', () => {
	it('returns the raw string when the timestamp is not a date', () => {
		assert.equal(formatActivityAt('not-a-date'), 'not-a-date');
	});

	it('includes a calendar day, not only a clock', () => {
		const now = new Date('2026-09-14T21:00:00');
		const at = '2026-09-13T15:04:05';
		const shown = formatActivityAt(at, now);
		assert.notEqual(shown, new Date(at).toLocaleTimeString());
		assert.match(shown, /[A-Za-z]{3}|\d{1,2}[/-]\d{1,2}/);
	});

	it('adds the year when the entry is not this year', () => {
		const now = new Date('2026-09-14T21:00:00');
		assert.match(formatActivityAt('2025-12-31T23:15:00', now), /2025/);
	});
});
