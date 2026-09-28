import assert from 'node:assert/strict';
import {_createFixture} from '../_helpers/integration-test.js';

/**
@type {ReturnType<typeof createFixture<typeof import('../../source/git-util.js')>>}
*/
const createFixture = _createFixture('../../source/git-util.js');

createFixture('returns current branch', async ({$$}) => {
	await $$`git switch -c unicorn`;
}, async ({
	testedModule: {getCurrentBranch},
}) => {
	const currentBranch = await getCurrentBranch();
	assert.equal(currentBranch, 'unicorn');
});
