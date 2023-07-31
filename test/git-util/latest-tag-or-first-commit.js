import test from 'ava';
import {_createFixture} from '../_helpers/integration-test.js';

/** @type {ReturnType<typeof _createFixture<import('../../source/git-util.js')>>} */
const createFixture = _createFixture('../../source/git-util.js');

// From https://stackoverflow.com/a/3357357/10292952
const getCommitMessage = async ($$, sha) => $$`git log --format=%B -n 1 ${sha}`;

test('one tag', createFixture, async ({$$}) => {
	await $$`git tag v0.0.0`;
}, async ({t, testedModule: {latestTagOrFirstCommit}}) => {
	const result = await latestTagOrFirstCommit();
	t.is(result, 'v0.0.0');
});

test('two tags', createFixture, async ({t, $$}) => {
	await $$`git tag v0.0.0`;
	await t.context.commitNewFile();
	await $$`git tag v1.0.0`;
}, async ({t, testedModule: {latestTagOrFirstCommit}}) => {
	const result = await latestTagOrFirstCommit();
	t.is(result, 'v1.0.0');
});

test('no tags (fallback)', createFixture, async () => {
	//
}, async ({t, testedModule: {latestTagOrFirstCommit}, $$}) => {
	const result = await latestTagOrFirstCommit();
	const {stdout: firstCommitMessage} = await getCommitMessage($$, result);

	t.is(firstCommitMessage.trim(), '"init1"');
});
