import test from 'ava';
import {_createFixture} from '../_helpers/integration-test.js';

/** @type {ReturnType<typeof _createFixture<import('../../source/git-util.js')>>} */
const createFixture = _createFixture('../../source/git-util.js');

test('removes latest commit', createFixture, async ({t, $$}) => {
	await t.context.createFile('index.js');
	await $$`git add -A`;
	await $$`git commit -m "added"`;
}, async ({t, testedModule: {removeLastCommit}, $$}) => {
	const {stdout: commitsBefore} = await $$`git log --pretty="%s"`;
	t.true(commitsBefore.includes('"added"'));

	await removeLastCommit();

	const {stdout: commitsAfter} = await $$`git log --pretty="%s"`;
	t.false(commitsAfter.includes('"added"'));
});
