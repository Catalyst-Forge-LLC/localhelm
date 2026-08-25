import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { formatBrief } from './briefFormat.js';

describe('formatBrief', () => {
	it('lists dirty, unpublished, and down-with-recipe', () => {
		const md = formatBrief({
			projects: [
				{
					id: 'gui4cli',
					missing: false,
					unpublishedAhead: true,
					localVersion: '0.0.1',
					private: false,
					npm: { name: 'gui4cli', status: 'ok', latest: '0.0.0' },
					git: {
						dirty: false,
						ahead: 2,
						behind: 0,
						repo: true,
						origin: 'https://example.com',
						branch: 'main',
					},
				},
				{
					id: 'localhelm',
					missing: false,
					unpublishedAhead: false,
					localVersion: '0.0.0',
					private: false,
					npm: { status: 'ok' },
					git: { dirty: true, ahead: 1, behind: 0, repo: true, origin: 'https://example.com' },
				},
			],
			leases: [
				{ id: 'dictawhisper', listening: true, recipe: 'pnpm serve' },
				{ id: 'dictawhisper-site', listening: false, recipe: 'pnpm site:dev' },
			],
			activityTitles: ['localberth start dictawhisper'],
		});
		assert.match(md, /publish gui4cli 0.0.1/);
		assert.match(md, /dirty localhelm|push localhelm/);
		assert.match(md, /down with recipe dictawhisper-site/);
		assert.match(md, /localberth start dictawhisper/);
	});
});
