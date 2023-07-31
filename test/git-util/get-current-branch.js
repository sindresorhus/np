import test from 'ava';
import {_createFixture} from '../_helpers/integration-test.js';

/** @type {ReturnType<typeof _createFixture<import('../../source/git-util.js')>>} */
const createFixture = _createFixture('../../source/git-util.js');

test('returns current branch', createFixture, async ({$$}) => {
	await $$`git switch -c unicorn`;
}, async ({t, testedModule: {getCurrentBranch}}) => {
	const currentBranch = await getCurrentBranch();
	t.is(currentBranch, 'unicorn');
});
