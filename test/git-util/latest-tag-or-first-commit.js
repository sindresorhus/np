import assert from 'node:assert/strict';
import {_createFixture} from '../_helpers/integration-test.js';

/**
@type {ReturnType<typeof createFixture<typeof import('../../source/git-util.js')>>}
*/
const createFixture = _createFixture('../../source/git-util.js');

// From https://stackoverflow.com/a/3357357/10292952
const getCommitMessage = async ($$, sha) => $$`git log --format=%B -n 1 ${sha}`;

createFixture('one tag', async ({$$}) => {
	await $$`git tag v0.0.0`;
}, async ({
	testedModule: {latestTagOrFirstCommit},
}) => {
	const result = await latestTagOrFirstCommit();
	assert.equal(result, 'v0.0.0');
});

createFixture('two tags', async ({context, $$}) => {
	await $$`git tag v0.0.0`;
	await context.commitNewFile();
	await $$`git tag v1.0.0`;
}, async ({
	testedModule: {latestTagOrFirstCommit},
}) => {
	const result = await latestTagOrFirstCommit();
	assert.equal(result, 'v1.0.0');
});

createFixture('no tags (fallback)', async () => {
	//
}, async ({
	testedModule: {latestTagOrFirstCommit},
	$$,
}) => {
	const result = await latestTagOrFirstCommit();
	const {stdout: firstCommitMessage} = await getCommitMessage($$, result);

	assert.equal(firstCommitMessage.trim(), '"init1"');
});
