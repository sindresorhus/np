import test from 'node:test';
import assert from 'node:assert/strict';
import {_createFixture} from '../_helpers/integration-test.js';
import {npRootDirectory} from '../../source/util.js';
import {root} from '../../source/git-util.js';

/**
@type {ReturnType<typeof createFixture<typeof import('../../source/git-util.js')>>}
*/
const createFixture = _createFixture('../../source/git-util.js');

test('returns np root dir', async () => {
	assert.equal(await root(), npRootDirectory);
});

createFixture('returns root dir of temp dir', () => {
	//
}, async ({
	testedModule: git,
	temporaryDirectory,
}) => {
	assert.equal(await git.root(), temporaryDirectory);
});
