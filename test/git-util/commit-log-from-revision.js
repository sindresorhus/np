import test from 'ava';
import {stripIndent} from 'common-tags';
import {_createFixture} from '../_helpers/integration-test.js';

/** @type {ReturnType<typeof _createFixture<import('../../source/git-util.js')>>} */
const createFixture = _createFixture('../../source/git-util.js');

test('returns single commit', createFixture, async () => {
	//
}, async ({t, testedModule: {commitLogFromRevision}, $$}) => {
	await $$`git tag v0.0.0`;
	const {sha, commitMessage} = await t.context.commitNewFile();

	t.is(await commitLogFromRevision('v0.0.0'), `${commitMessage} ${sha}`);
});

test('returns multiple commits, from newest to oldest', createFixture, async () => {
	//
}, async ({t, testedModule: {commitLogFromRevision}, $$}) => {
	await $$`git tag v0.0.0`;
	const commit1 = await t.context.commitNewFile();
	const commit2 = await t.context.commitNewFile();
	const commit3 = await t.context.commitNewFile();

	const commitLog = stripIndent`
		${commit3.commitMessage} ${commit3.sha}
		${commit2.commitMessage} ${commit2.sha}
		${commit1.commitMessage} ${commit1.sha}
	`;

	t.is(await commitLogFromRevision('v0.0.0'), commitLog);
});
