import test from 'ava';
import {_createFixture} from '../_helpers/integration-test.js';

/** @type {ReturnType<typeof _createFixture<import('../../source/git-util.js')>>} */
const createFixture = _createFixture('../../source/git-util.js');

// From https://stackoverflow.com/a/3357357/10292952
const getCommitMessage = async ($$, sha) => $$`git log --format=%B -n 1 ${sha}`;

// TODO: `tagList` always has a minimum length of 1 -> `''.split('\n')` => `['']`
test.failing('no tags', createFixture, () => {}, async ({t, testedModule: {previousTagOrFirstCommit}}) => {
	const result = await previousTagOrFirstCommit();
	t.is(result, undefined);
});

test('one tag', createFixture, async ({$$}) => {
	await $$`git tag v0.0.0`;
}, async ({t, testedModule: {previousTagOrFirstCommit}, $$}) => {
	const result = await previousTagOrFirstCommit();
	const {stdout: firstCommitMessage} = await getCommitMessage($$, result);

	t.is(firstCommitMessage.trim(), '"init1"');
});

test('two tags', createFixture, async ({t, $$}) => {
	await $$`git tag v0.0.0`;

	await t.context.createFile('new');
	await $$`git add new`;
	await $$`git commit -m 'added'`;

	await $$`git tag v1.0.0`;
}, async ({t, testedModule: {previousTagOrFirstCommit}}) => {
	const result = await previousTagOrFirstCommit();
	t.is(result, 'v0.0.0');
});

test.todo('test fallback case');
