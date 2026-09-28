import assert from 'node:assert/strict';
import {_createFixture} from '../_helpers/integration-test.js';

/**
@type {ReturnType<typeof createFixture<typeof import('../../source/git-util.js')>>}
*/
const createFixture = _createFixture('../../source/git-util.js');

createFixture('returns latest tag', async ({$$}) => {
	await $$`git tag v0.0.0`;
}, async ({
	testedModule: {latestTag},
}) => {
	assert.equal(await latestTag(), 'v0.0.0');
});

createFixture('returns latest tag - multiple set', async ({context, $$}) => {
	await $$`git tag v0.0.0`;
	/* eslint-disable no-await-in-loop -- sequential git tag creation requires ordered async execution */
	for (const major of [1, 2, 3, 4]) {
		await context.commitNewFile();
		await $$`git tag v${major}.0.0`;
	}
	/* eslint-enable no-await-in-loop */
}, async ({
	testedModule: {latestTag},
}) => {
	assert.equal(await latestTag(), 'v4.0.0');
});
