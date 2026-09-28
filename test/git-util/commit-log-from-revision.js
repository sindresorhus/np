import assert from 'node:assert/strict';
import {stripIndent} from 'common-tags';
import {_createFixture} from '../_helpers/integration-test.js';

/**
@type {ReturnType<typeof createFixture<typeof import('../../source/git-util.js')>>}
*/
const createFixture = _createFixture('../../source/git-util.js');

createFixture('returns single commit', async () => {
	//
}, async ({context, testedModule: {commitLogFromRevision}, $$}) => {
	await $$`git tag v0.0.0`;
	const {sha, commitMessage} = await context.commitNewFile();

	assert.equal(await commitLogFromRevision('v0.0.0'), `${commitMessage} ${sha}`);
});

createFixture('returns multiple commits, from newest to oldest', async () => {
	//
}, async ({context, testedModule: {commitLogFromRevision}, $$}) => {
	await $$`git tag v0.0.0`;
	const commit1 = await context.commitNewFile();
	const commit2 = await context.commitNewFile();
	const commit3 = await context.commitNewFile();

	const commitLog = stripIndent`
        ${commit3.commitMessage} ${commit3.sha}
        ${commit2.commitMessage} ${commit2.sha}
        ${commit1.commitMessage} ${commit1.sha}
    `;

	assert.equal(await commitLogFromRevision('v0.0.0'), commitLog);
});
