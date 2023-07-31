import test from 'ava';
import {_createFixture} from '../_helpers/integration-test.js';

/** @type {ReturnType<typeof _createFixture<import('../../source/git-util.js')>>} */
const createFixture = _createFixture('../../source/git-util.js');

test('on release branch', createFixture, async ({$$}) => {
	await $$`git switch -c unicorn`;
}, async ({t, testedModule: {verifyCurrentBranchIsReleaseBranch}}) => {
	await t.notThrowsAsync(
		verifyCurrentBranchIsReleaseBranch('unicorn'),
	);
});

test('not on release branch', createFixture, async ({$$}) => {
	await $$`git switch -c unicorn`;
}, async ({t, testedModule: {verifyCurrentBranchIsReleaseBranch}}) => {
	await t.throwsAsync(
		verifyCurrentBranchIsReleaseBranch('main'),
		{message: 'Not on `main` branch. Use --any-branch to publish anyway, or set a different release branch using --branch.'},
	);
});
