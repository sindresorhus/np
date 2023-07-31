import test from 'ava';
import {_createFixture} from '../_helpers/integration-test.js';

/** @type {ReturnType<typeof _createFixture<import('../../source/git-util.js')>>} */
const createFixture = _createFixture('../../source/git-util.js');

test('returns single commit', createFixture, async ({t, $$}) => {
	await $$`git tag v0.0.0`;
	await t.context.createFile('index.js');
	await $$`git add -A`;
	await $$`git commit -m "added"`;
}, async ({t, testedModule: git, $$}) => {
	const {stdout: lastCommitSha} = await $$`git rev-parse --short HEAD`;
	t.is(await git.commitLogFromRevision('v0.0.0'), `"added" ${lastCommitSha}`);
});

test.todo('returns multiple commits');
