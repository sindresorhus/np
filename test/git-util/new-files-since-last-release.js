import path from 'node:path';
import assert from 'node:assert/strict';
import {_createFixture} from '../_helpers/integration-test.js';

/**
@type {ReturnType<typeof createFixture<typeof import('../../source/git-util.js')>>}
*/
const createFixture = _createFixture('../../source/git-util.js');

createFixture('returns files added since latest tag', async ({context, $$}) => {
	await $$`git tag v0.0.0`;
	await context.createFile('new');
	await context.createFile('index.js');
	await $$`git add .`;
	await $$`git commit -m "added"`;
}, async ({
	testedModule: {newFilesSinceLastRelease},
	temporaryDirectory,
}) => {
	const newFiles = await newFilesSinceLastRelease(temporaryDirectory);
	assert.deepEqual(
		newFiles.toSorted((a, b) => a.localeCompare(b)),
		['new', 'index.js'].toSorted((a, b) => a.localeCompare(b)),
	);
});

createFixture('no files', async ({$$}) => {
	await $$`git tag v0.0.0`;
}, async ({
	testedModule: {newFilesSinceLastRelease},
	temporaryDirectory,
}) => {
	const newFiles = await newFilesSinceLastRelease(temporaryDirectory);
	assert.deepEqual(newFiles, []);
});

createFixture('uses ignoreWalker', async ({context}) => {
	await context.createFile('index.js');
	await context.createFile('package.json');
	await context.createFile('package-lock.json');
	await context.createFile('.gitignore', 'package-lock.json\n.git'); // ignoreWalker doesn't ignore `.git`: npm/ignore-walk#2
}, async ({
	testedModule: {newFilesSinceLastRelease},
	temporaryDirectory,
}) => {
	const newFiles = await newFilesSinceLastRelease(temporaryDirectory);
	assert.deepEqual(
		newFiles.toSorted((a, b) => a.localeCompare(b)),
		['index.js', 'package.json', '.gitignore'].toSorted((a, b) => a.localeCompare(b)),
	);
});

createFixture(
	'returns files relative to a package in a subdirectory',
	async ({context, $$}) => {
		await $$`git tag v0.0.0`;
		await context.createFile('outside.js');
		await context.createFile('dist/index.js');
		await context.createFile('dist/package.json');
		await $$`git add .`;
		await $$`git commit -m "added"`;
	},
	async ({
		testedModule: {newFilesSinceLastRelease},
		temporaryDirectory,
	}) => {
		const newFiles = await newFilesSinceLastRelease(path.join(temporaryDirectory, 'dist'));
		assert.deepEqual(
			newFiles.toSorted((a, b) => a.localeCompare(b)),
			['index.js', 'package.json'],
		);
	},
);
