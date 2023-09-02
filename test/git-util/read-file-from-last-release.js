import test from 'ava';
import {_createFixture} from '../_helpers/integration-test.js';

/** @type {ReturnType<typeof _createFixture<import('../../source/git-util.js')>>} */
const createFixture = _createFixture('../../source/git-util.js');

test('returns content of a given file', createFixture, async ({t, $$}) => {
	await t.context.createFile('unicorn.txt', 'unicorn-1');
	await $$`git add .`;
	await $$`git commit -m "added"`;
	await $$`git tag v0.0.0`;
	await t.context.createFile('unicorn.txt', 'unicorn-2');
	await $$`git add .`;
	await $$`git commit -m "added"`;
}, async ({t, testedModule: {readFileFromLastRelease}}) => {
	const file = await readFileFromLastRelease('unicorn.txt');
	t.is(file, 'unicorn-1');
});

test('fails if file not in previous release', createFixture, async ({t, $$}) => {
	await $$`git tag v0.0.0`;
	await t.context.createFile('unicorn.txt', 'unicorn');
	await $$`git add .`;
	await $$`git commit -m "added"`;
}, async ({t, testedModule: {readFileFromLastRelease}}) => {
	await t.throwsAsync(
		readFileFromLastRelease('unicorn.txt'),
		{message: /fatal: path '[^']*' exists on disk, but not in 'v0\.0\.0'/},
	);
});

test('no previous release', createFixture, async ({t, $$}) => {
	await t.context.createFile('unicorn.txt', 'unicorn');
	await $$`git add .`;
	await $$`git commit -m "added"`;
}, async ({t, testedModule: {readFileFromLastRelease}}) => {
	await t.throwsAsync(
		readFileFromLastRelease('unicorn.txt'),
		{message: /fatal: No names found, cannot describe anything./},
	);
});

// These errors could probably be handled in 'readFileFromLastRelease'
