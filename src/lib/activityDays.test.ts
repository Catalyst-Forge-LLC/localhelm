import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
	activityDayGroups,
	activityDayKey,
	activityMonthGroups,
	activitySparkCaption,
	activitySparkSeries,
} from './activityDays.js';

const noon = (isoDay: string) => `${isoDay}T12:00:00`;

describe('activityDays', () => {
	it('keys a stamp to the local calendar day', () => {
		assert.equal(activityDayKey(noon('2026-09-15')), '2026-09-15');
		assert.equal(activityDayKey('not-a-date'), null);
	});

	it('groups newest day first and counts writes', () => {
		const now = new Date('2026-09-15T18:00:00');
		const days = activityDayGroups(
			[
				{ at: noon('2026-09-15') },
				{ at: noon('2026-09-14') },
				{ at: noon('2026-09-15') },
			],
			now,
		);
		assert.deepEqual(
			days.map((day) => ({ key: day.key, count: day.count, dom: day.dom })),
			[
				{ key: '2026-09-15', count: 2, dom: '15' },
				{ key: '2026-09-14', count: 1, dom: '14' },
			],
		);
	});

	it('nests days under months newest first', () => {
		const now = new Date('2026-09-15T18:00:00');
		const months = activityMonthGroups(
			activityDayGroups([{ at: noon('2026-08-31') }, { at: noon('2026-09-01') }], now),
			now,
		);
		assert.deepEqual(
			months.map((month) => ({ key: month.key, days: month.days.map((day) => day.key) })),
			[
				{ key: '2026-09', days: ['2026-09-01'] },
				{ key: '2026-08', days: ['2026-08-31'] },
			],
		);
	});

	it('builds a 14-day spark ending today', () => {
		const now = new Date('2026-09-15T18:00:00');
		const series = activitySparkSeries([{ at: noon('2026-09-15') }, { at: noon('2026-09-02') }], 14, now);
		assert.equal(series.length, 14);
		assert.equal(series[0], 1);
		assert.equal(series[13], 1);
		assert.equal(
			series.slice(1, 13).every((n) => n === 0),
			true,
		);
	});

	it('captions quiet and busy sparks', () => {
		assert.equal(activitySparkCaption([0, 0, 0]), 'No writes in the log');
		assert.equal(activitySparkCaption([1, 0, 2]), '2 today · 3 in 3d');
		assert.equal(activitySparkCaption([4, 1, 0]), '5 writes · last 3d');
	});
});
