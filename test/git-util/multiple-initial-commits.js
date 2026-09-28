import assert from 'node:assert/strict';
import {_createFixture} from '../_helpers/integration-test.js';

/**
@type {ReturnType<typeof createFixture<typeof import('../../source/git-util.js')>>}
*/
const createFixture = _createFixture('../../source/git-util.js');

createFixture('repository with multiple initial commits', async ({context, $$}) => {
	// Get the current branch name before creating orphan branch
	const {stdout: initialBranch} = await $$`git branch --show-current`;

	// Create a second orphan branch to simulate multiple initial commits
	await $$`git checkout --orphan other-branch`;
	await context.createFile('other-file');
	await $$`git add other-file`;
	await $$`git commit -m orphan`;

	// Merge the orphan branch into the initial branch, creating multiple root commits
	await $$`git checkout ${initialBranch}`;
	await $$`git merge --allow-unrelated-histories other-branch -m merge`;
}, async ({
	testedModule: {latestTagOrFirstCommit, commitLogFromRevision},
}) => {
	// This should not throw an error even with multiple initial commits
	const result = await latestTagOrFirstCommit();

	// Verify result is a valid commit hash (single line)
	assert.ok(!(result.includes('\n')), 'Result should be a single commit hash');
	assert.equal(result.length, 40, 'Result should be a 40-character SHA-1 hash');

	// This was the operation that failed in the original issue
	await assert.doesNotReject(async () => {
		await commitLogFromRevision(result);
	}, 'commitLogFromRevision should work with the returned first commit');
});
