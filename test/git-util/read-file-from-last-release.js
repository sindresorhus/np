import assert from 'node:assert/strict';
import {_createFixture} from '../_helpers/integration-test.js';

/**
@type {ReturnType<typeof createFixture<typeof import('../../source/git-util.js')>>}
*/
const createFixture = _createFixture('../../source/git-util.js');

createFixture('returns content of a given file', async ({context, $$}) => {
	await context.createFile('unicorn.txt', 'unicorn-1');
	await $$`git add .`;
	await $$`git commit -m "added"`;
	await $$`git tag v0.0.0`;
	await context.createFile('unicorn.txt', 'unicorn-2');
	await $$`git add .`;
	await $$`git commit -m "added"`;
}, async ({
	testedModule: {readFileFromLastRelease},
}) => {
	const file = await readFileFromLastRelease('unicorn.txt');
	assert.equal(file, 'unicorn-1');
});

createFixture('fails if file not in previous release', async ({context, $$}) => {
	await $$`git tag v0.0.0`;
	await context.createFile('unicorn.txt', 'unicorn');
	await $$`git add .`;
	await $$`git commit -m "added"`;
}, async ({
	testedModule: {readFileFromLastRelease},
}) => {
	await assert.rejects(
		readFileFromLastRelease('unicorn.txt'),
		{message: /fatal: path '[^']*' exists on disk, but not in 'v0\.0\.0'/v},
	);
});

createFixture('no previous release', async ({context, $$}) => {
	await context.createFile('unicorn.txt', 'unicorn');
	await $$`git add .`;
	await $$`git commit -m "added"`;
}, async ({
	testedModule: {readFileFromLastRelease},
}) => {
	await assert.rejects(
		readFileFromLastRelease('unicorn.txt'),
		{message: /fatal: No names found, cannot describe anything\./v},
	);
});

// These errors could probably be handled in 'readFileFromLastRelease'
