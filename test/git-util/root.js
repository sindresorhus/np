import test from 'ava';
import {_createFixture} from '../_helpers/integration-test.js';
import {npRootDir} from '../../source/util.js';
import {root} from '../../source/git-util.js';

/** @type {ReturnType<typeof _createFixture<import('../../source/git-util.js')>>} */
const createFixture = _createFixture('../../source/git-util.js');

test('returns np root dir', async t => {
	t.is(await root(), npRootDir);
});

test('returns root dir of temp dir', createFixture, () => {
	//
}, async ({t, testedModule: git, temporaryDir}) => {
	t.is(await git.root(), temporaryDir);
});
