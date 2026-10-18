import assert from 'node:assert/strict';
import path from 'node:path';
import {_createFixture} from '../_helpers/integration-test.js';

const createFixture = _createFixture('../../source/git-util.js');

createFixture('returns non-ASCII file names without Git quoting', async ({context, $$}) => {
	await $$`git tag v0.0.0`;
	await context.createFile('café.js');
	await context.createFile('日本語.md');
	await $$`git add .`;
	await $$`git commit -m added`;
}, async ({testedModule: {newFilesSinceLastRelease}, temporaryDirectory}) => {
	const files = await newFilesSinceLastRelease(temporaryDirectory);
	assert.deepEqual(files.toSorted((left, right) => left.localeCompare(right)), ['café.js', '日本語.md']);
});

createFixture('preserves whitespace in new file names', async ({context, $$}) => {
	await $$`git tag v0.0.0`;
	await context.createFile(' leading.js');
	await context.createFile('trailing.js ');
	await context.createFile('line\nbreak.js');
	await $$`git add .`;
	await $$`git commit -m added`;
}, async ({testedModule: {newFilesSinceLastRelease}, temporaryDirectory}) => {
	const files = await newFilesSinceLastRelease(temporaryDirectory);
	assert.deepEqual(files.toSorted((left, right) => left.localeCompare(right)), [' leading.js', 'line\nbreak.js', 'trailing.js ']);
});

createFixture('preserves non-ASCII file names relative to a package subdirectory', async ({context, $$}) => {
	await $$`git tag v0.0.0`;
	await context.createFile('outside.js');
	await context.createFile('dist/café.js');
	await $$`git add .`;
	await $$`git commit -m added`;
}, async ({testedModule: {newFilesSinceLastRelease}, temporaryDirectory}) => {
	assert.deepEqual(await newFilesSinceLastRelease(path.join(temporaryDirectory, 'dist')), ['café.js']);
});
