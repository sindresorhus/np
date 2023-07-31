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

test.todo('deletes given tag from a large list');
test.todo('no tags');
