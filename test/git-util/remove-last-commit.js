import assert from 'node:assert/strict';
import {_createFixture} from '../_helpers/integration-test.js';

/**
@type {ReturnType<typeof createFixture<typeof import('../../source/git-util.js')>>}
*/
const createFixture = _createFixture('../../source/git-util.js');

createFixture('removes latest commit', async ({context, $$}) => {
	await context.createFile('index.js');
	await $$`git add -A`;
	await $$`git commit -m "added"`;
}, async ({
	testedModule: {removeLastCommit},
	$$,
}) => {
	const {stdout: commitsBefore} = await $$`git log --pretty="%s"`;
	assert.ok(commitsBefore.includes('"added"'));

	await removeLastCommit();

	const {stdout: commitsAfter} = await $$`git log --pretty="%s"`;
	assert.ok(!(commitsAfter.includes('"added"')));
});
