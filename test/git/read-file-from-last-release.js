import test from 'ava';
import {_createFixture} from '../_helpers/integration-test.js';

/** @type {ReturnType<typeof _createFixture<import('../../source/git-util.js')>>} */
const createFixture = _createFixture('../../source/git-util.js');

// TODO: failing, seems like issue with path.relative
test.failing('returns content of a given file', createFixture, async ({t, $$}) => {
	await $$`git tag v0.0.0`;
	await t.context.createFile('unicorn.txt', 'unicorn');
	await $$`git add -A`;
	await $$`git commit -m "added"`;
}, async ({t, testedModule: git}) => {
	const file = await git.readFileFromLastRelease('unicorn.txt');
	t.is(file, 'unicorn');
});
