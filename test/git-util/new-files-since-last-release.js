import test from 'ava';
import {_createFixture} from '../_helpers/integration-test.js';

/** @type {ReturnType<typeof _createFixture<import('../../source/git-util.js')>>} */
const createFixture = _createFixture('../../source/git-util.js');

test('returns files added since latest tag', createFixture, async ({t, $$}) => {
	await $$`git tag v0.0.0`;
	await t.context.createFile('new');
	await t.context.createFile('index.js');
	await $$`git add .`;
	await $$`git commit -m "added"`;
}, async ({t, testedModule: {newFilesSinceLastRelease}, temporaryDir}) => {
	const newFiles = await newFilesSinceLastRelease(temporaryDir);
	t.deepEqual(
		newFiles.sort(),
		['new', 'index.js'].sort(),
	);
});

test('no files', createFixture, async ({$$}) => {
	await $$`git tag v0.0.0`;
}, async ({t, testedModule: {newFilesSinceLastRelease}, temporaryDir}) => {
	const newFiles = await newFilesSinceLastRelease(temporaryDir);
	t.deepEqual(newFiles, []);
});

test('uses ignoreWalker', createFixture, async ({t}) => {
	await t.context.createFile('index.js');
	await t.context.createFile('package.json');
	await t.context.createFile('package-lock.json');
	await t.context.createFile('.gitignore', 'package-lock.json\n.git'); // ignoreWalker doesn't ignore `.git`: npm/ignore-walk#2
}, async ({t, testedModule: {newFilesSinceLastRelease}, temporaryDir}) => {
	const newFiles = await newFilesSinceLastRelease(temporaryDir);
	t.deepEqual(
		newFiles.sort(),
		['index.js', 'package.json', '.gitignore'].sort(),
	);
});
