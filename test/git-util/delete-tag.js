import test from 'ava';
import {_createFixture} from '../_helpers/integration-test.js';

/** @type {ReturnType<typeof _createFixture<import('../../source/git-util.js')>>} */
const createFixture = _createFixture('../../source/git-util.js');

test('deletes given tag', createFixture, async ({$$}) => {
	await $$`git tag v0.0.0`;
	await $$`git tag v1.0.0`;
}, async ({t, testedModule: {deleteTag}, $$}) => {
	await deleteTag('v1.0.0');
	const {stdout: tags} = await $$`git tag`;

	t.is(tags, 'v0.0.0');
});

test('deletes given tag from a large list', createFixture, async ({$$}) => {
	await $$`git tag v0.0.0`;
	await $$`git tag v1.0.0`;
	await $$`git tag v2.0.0`;
	await $$`git tag v3.0.0`;
	await $$`git tag v4.0.0`;
}, async ({t, testedModule: {deleteTag}, $$}) => {
	await deleteTag('v2.0.0');
	const {stdout: tags} = await $$`git tag`;

	t.deepEqual(
		tags.split('\n'),
		['v0.0.0', 'v1.0.0', 'v3.0.0', 'v4.0.0'],
	);
});

test('throws if tag not found', createFixture, async () => {
	//
}, async ({t, testedModule: {deleteTag}}) => {
	await t.throwsAsync(
		deleteTag('v1.0.0'),
		{message: /error: tag 'v1\.0\.0' not found\./},
	);
});
