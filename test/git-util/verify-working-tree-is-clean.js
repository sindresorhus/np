import assert from 'node:assert/strict';
import {_createFixture} from '../_helpers/integration-test.js';

/**
@type {ReturnType<typeof createFixture<typeof import('../../source/git-util.js')>>}
*/
const createFixture = _createFixture('../../source/git-util.js');

createFixture('clean', async ({context, $$}) => {
	await context.createFile('index.js');
	await $$`git add .`;
	await $$`git commit -m "added"`;
}, async ({
	testedModule: {verifyWorkingTreeIsClean},
}) => {
	await assert.doesNotReject(verifyWorkingTreeIsClean());
});

createFixture('not clean', async ({context}) => {
	await context.createFile('index.js');
}, async ({
	testedModule: {verifyWorkingTreeIsClean},
}) => {
	await assert.rejects(
		verifyWorkingTreeIsClean(),
		{message: 'Unclean working tree. Commit or stash changes first.'},
	);
});
