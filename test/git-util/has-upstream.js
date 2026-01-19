import test from 'ava';
import {_createFixture} from '../_helpers/integration-test.js';

/** @type {ReturnType<typeof _createFixture<import('../../source/git-util.js')>>} */
const createFixture = _createFixture('../../source/git-util.js');

test('no upstream', createFixture, async () => {
	//
}, async ({t, testedModule: {hasUpstream}}) => {
	t.false(await hasUpstream());
});
