import assert from 'node:assert/strict';
import { it } from 'node:test';
import { assertPublishConfirmation } from './publishConfirmation.js';
it('requires every eligible project revision, while blocked rows never acquire write permission', () => {
	const rows = [{ id: 'a', action: 'publish', revision: 'current' }, { id: 'b', action: 'skip' }];
	assert.throws(() => assertPublishConfirmation(rows), /confirmation/);
	assert.throws(() => assertPublishConfirmation(rows, { a: 'stale' }), /plan changed/);
	assert.doesNotThrow(() => assertPublishConfirmation(rows, { a: 'current' }));
	assert.throws(() => assertPublishConfirmation([...rows, { id: 'c', action: 'publish', revision: 'c' }], { a: 'current' }), /confirmation/);
});
