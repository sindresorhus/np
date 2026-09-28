import assert from 'node:assert/strict';
import {_createFixture} from '../_helpers/integration-test.js';

/**
@type {ReturnType<typeof createFixture<typeof import('../../source/git-util.js')>>}
*/
const createFixture = _createFixture('../../source/git-util.js');

createFixture('deletes given tag', async ({$$}) => {
	await $$`git tag v0.0.0`;
	await $$`git tag v1.0.0`;
}, async ({
	testedModule: {deleteTag},
	$$,
}) => {
	await deleteTag('v1.0.0');
	const {stdout: tags} = await $$`git tag`;

	assert.equal(tags, 'v0.0.0');
});

createFixture('deletes given tag from a large list', async ({$$}) => {
	await $$`git tag v0.0.0`;
	await $$`git tag v1.0.0`;
	await $$`git tag v2.0.0`;
	await $$`git tag v3.0.0`;
	await $$`git tag v4.0.0`;
}, async ({
	testedModule: {deleteTag},
	$$,
}) => {
	await deleteTag('v2.0.0');
	const {stdout: tags} = await $$`git tag`;

	assert.deepEqual(
		tags.split('\n'),
		['v0.0.0', 'v1.0.0', 'v3.0.0', 'v4.0.0'],
	);
});

createFixture('throws if tag not found', async () => {
	//
}, async ({
	testedModule: {deleteTag},
}) => {
	await assert.rejects(
		deleteTag('v1.0.0'),
		{message: /error: tag 'v1\.0\.0' not found\./v},
	);
});
