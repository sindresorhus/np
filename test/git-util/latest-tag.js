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

	await t.context.createFile('new');
	await $$`git add new`;
	await $$`git commit -m 'added'`;

	await $$`git tag v1.0.0`;
}, async ({t, testedModule: {latestTag}}) => {
	t.is(await latestTag(), 'v1.0.0');
});
