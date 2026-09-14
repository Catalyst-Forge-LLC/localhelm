import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { isJobCancelled, JobCancelledError, stoppedJobMessage } from './jobCancel.js';

describe('JobCancelledError', () => {
	it('says nothing ran when stop is before the first item', () => {
		assert.equal(stoppedJobMessage(0, 4), 'Stopped before the first of 4. Nothing else will run.');
		const err = new JobCancelledError(0, 4);
		assert.equal(isJobCancelled(err), true);
		assert.match(err.message, /before the first/);
	});

	it('names how many finished when stop is mid-batch', () => {
		assert.equal(stoppedJobMessage(2, 9), 'Stopped after 2 of 9. The rest were not started.');
		assert.equal(isJobCancelled(new Error('nope')), false);
	});
});
