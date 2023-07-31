import test from 'ava';
import {_createFixture} from '../_helpers/integration-test.js';

/** @type {ReturnType<typeof _createFixture<import('../../source/git-util.js')>>} */
const createFixture = _createFixture('../../source/git-util.js');

test('returns latest tag', createFixture, async ({$$}) => {
	await $$`git tag v0.0.0`;
}, async ({t, testedModule: {latestTag}}) => {
	t.is(await latestTag(), 'v0.0.0');
});

test('returns latest tag - multiple set', createFixture, async ({t, $$}) => {
	await $$`git tag v0.0.0`;
	/* eslint-disable no-await-in-loop */
	for (const major of [1, 2, 3, 4]) {
		await t.context.commitNewFile();
		await $$`git tag v${major}.0.0`;
	}
	/* eslint-enable no-await-in-loop */
}, async ({t, testedModule: {latestTag}}) => {
	t.is(await latestTag(), 'v4.0.0');
});
