import test from 'ava';
import {_createFixture} from '../_helpers/integration-test.js';

/** @type {ReturnType<typeof _createFixture<import('../../source/git-util.js')>>} */
const createFixture = _createFixture('../../source/git-util.js');

test('not detached', createFixture, async () => {
	//
}, async ({t, testedModule: {isHeadDetached}}) => {
	t.false(await isHeadDetached());
});

test('detached', createFixture, async ({$$}) => {
	const {stdout: firstCommitSha} = await $$`git rev-list --max-parents=0 HEAD`;
	await $$`git checkout ${firstCommitSha}`;
}, async ({t, testedModule: {isHeadDetached}}) => {
	t.true(await isHeadDetached());
});
