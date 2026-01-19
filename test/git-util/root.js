import test from 'ava';
import {_createFixture} from '../_helpers/integration-test.js';
import {npRootDirectory} from '../../source/util.js';
import {root} from '../../source/git-util.js';

/** @type {ReturnType<typeof _createFixture<import('../../source/git-util.js')>>} */
const createFixture = _createFixture('../../source/git-util.js');

test('returns np root dir', async t => {
	t.is(await root(), npRootDirectory);
});

test('returns root dir of temp dir', createFixture, () => {
	//
}, async ({t, testedModule: git, temporaryDirectory}) => {
	t.is(await git.root(), temporaryDirectory);
});
