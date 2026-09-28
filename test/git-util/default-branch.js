import assert from 'node:assert/strict';
import {_createFixture} from '../_helpers/integration-test.js';

/**
@type {ReturnType<typeof createFixture<typeof import('../../source/git-util.js')>>}
*/
const createFixture = _createFixture('../../source/git-util.js');

createFixture('main', async ({$$}) => {
	await $$`git checkout -B main`;
}, async ({
	testedModule: {defaultBranch},
}) => {
	assert.equal(await defaultBranch(), 'main');
});

createFixture('master', async ({$$}) => {
	await $$`git checkout -B master`;
	await $$`git update-ref -d refs/heads/main`;
}, async ({
	testedModule: {defaultBranch},
}) => {
	assert.equal(await defaultBranch(), 'master');
});

createFixture('gh-pages', async ({$$}) => {
	await $$`git checkout -B gh-pages`;
	await $$`git update-ref -d refs/heads/main`;
	await $$`git update-ref -d refs/heads/master`;
}, async ({
	testedModule: {defaultBranch},
}) => {
	assert.equal(await defaultBranch(), 'gh-pages');
});

createFixture('fails', async ({$$}) => {
	await $$`git checkout -B unicorn`;
	await $$`git update-ref -d refs/heads/main`;
	await $$`git update-ref -d refs/heads/master`;
}, async ({
	testedModule: {defaultBranch},
}) => {
	await assert.rejects(
		defaultBranch(),
		{message: 'Could not infer the default Git branch. Please specify one with the --branch flag or with a np config.'},
	);
});
