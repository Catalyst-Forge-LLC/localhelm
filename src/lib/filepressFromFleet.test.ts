import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { runWithDemo } from './demoMode.js';
import { enrollFilepressFromFleet } from './filepressFromFleet.js';
import type { LoadedManifest } from './manifest.js';

const loaded = {
	workspaceRoot: 'Z:/workspace',
	manifestPath: 'Z:/workspace/localhelm.fleet.json',
	manifest: { workspaceRoot: '.', projects: [] },
} as LoadedManifest;

describe('enrollFilepressFromFleet', () => {
	it('skips demo board so extras.json stays off the live FilePress list', async () => {
		const result = await runWithDemo(true, () => enrollFilepressFromFleet(loaded, ['Z:/workspace/clients/acme']));
		assert.equal(result, undefined);
	});

	it('skips an empty path list', async () => {
		assert.equal(await enrollFilepressFromFleet(loaded, []), undefined);
	});
});
