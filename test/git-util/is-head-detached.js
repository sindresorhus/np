import assert from 'node:assert/strict';
import {_createFixture} from '../_helpers/integration-test.js';

/**
@type {ReturnType<typeof createFixture<typeof import('../../source/git-util.js')>>}
*/
const createFixture = _createFixture('../../source/git-util.js');

createFixture('not detached', async () => {
	//
}, async ({
	testedModule: {isHeadDetached},
}) => {
	assert.ok(!(await isHeadDetached()));
});

createFixture('detached', async ({$$}) => {
	const {stdout: firstCommitSha} = await $$`git rev-list --max-parents=0 HEAD`;
	await $$`git checkout ${firstCommitSha}`;
}, async ({
	testedModule: {isHeadDetached},
}) => {
	assert.ok(await isHeadDetached());
});
