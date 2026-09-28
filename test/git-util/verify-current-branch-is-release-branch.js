import assert from 'node:assert/strict';
import {_createFixture} from '../_helpers/integration-test.js';

/**
@type {ReturnType<typeof createFixture<typeof import('../../source/git-util.js')>>}
*/
const createFixture = _createFixture('../../source/git-util.js');

createFixture('on release branch', async ({$$}) => {
	await $$`git switch -c unicorn`;
}, async ({
	testedModule: {verifyCurrentBranchIsReleaseBranch},
}) => {
	await assert.doesNotReject(verifyCurrentBranchIsReleaseBranch('unicorn'));
});

createFixture('not on release branch', async ({$$}) => {
	await $$`git switch -c unicorn`;
}, async ({
	testedModule: {verifyCurrentBranchIsReleaseBranch},
}) => {
	await assert.rejects(
		verifyCurrentBranchIsReleaseBranch('main'),
		{message: 'Not on `main` branch. Use --any-branch to publish anyway, or set a different release branch using --branch.'},
	);
});
