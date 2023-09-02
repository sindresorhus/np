import test from 'ava';
import {_createFixture} from '../_helpers/integration-test.js';

/** @type {ReturnType<typeof _createFixture<import('../../source/git-util.js')>>} */
const createFixture = _createFixture('../../source/git-util.js');

test('clean', createFixture, async ({t, $$}) => {
	await t.context.createFile('index.js');
	await $$`git add .`;
	await $$`git commit -m "added"`;
}, async ({t, testedModule: {verifyWorkingTreeIsClean}}) => {
	await t.notThrowsAsync(
		verifyWorkingTreeIsClean(),
	);
});

test('not clean', createFixture, async ({t}) => {
	await t.context.createFile('index.js');
}, async ({t, testedModule: {verifyWorkingTreeIsClean}}) => {
	await t.throwsAsync(
		verifyWorkingTreeIsClean(),
		{message: 'Unclean working tree. Commit or stash changes first.'},
	);
});
