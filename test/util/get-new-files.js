import path from 'node:path';
import test from 'ava';
import esmock from 'esmock';
import {execa} from 'execa';
import {writePackage} from 'write-package';
import {createIntegrationTest} from '../_helpers/integration-test.js';

const createNewFilesFixture = test.macro(async (t, input, commands) => {
	const {pkgFiles, expected: {unpublished, firstTime}} = input;

	await createIntegrationTest(t, async ({$$, temporaryDir}) => {
		/** @type {import('../../source/util.js')} */
		const {getNewFiles} = await esmock('../../source/util.js', {}, {
			'node:process': {cwd: () => temporaryDir},
			execa: {execa: async (...args) => execa(...args, {cwd: temporaryDir})},
		});

		await commands({t, $$, temporaryDir});

		await writePackage(temporaryDir, {
			name: 'foo',
			version: '0.0.0',
			...pkgFiles.length > 0 ? {files: pkgFiles} : {},
		});

		const assertions = await t.try(async tt => {
			tt.deepEqual(
				await getNewFiles(temporaryDir),
				{unpublished, firstTime},
			);
		});

		if (!assertions.passed) {
			t.log(input);
		}

		assertions.commit();
	});
});

test('files to package with tags added', createNewFilesFixture, {
	pkgFiles: ['*.js'],
	expected: {
		unpublished: ['new'],
		firstTime: ['index.js'],
	},
}, async ({t, $$}) => {
	await $$`git tag v0.0.0`;
	await t.context.createFile('new');
	await t.context.createFile('index.js');
	await $$`git add -A`;
	await $$`git commit -m "added"`;
});

test('file `new` to package without tags added', createNewFilesFixture, {
	pkgFiles: ['index.js'],
	expected: {
		unpublished: ['new'],
		firstTime: ['index.js', 'package.json'],
	},
}, async ({t}) => {
	await t.context.createFile('new');
	await t.context.createFile('index.js');
});

(() => { // Wrapper to have constants with macro
	const longPath = path.join('veryLonggggggDirectoryName', 'veryLonggggggDirectoryName');
	const filePath1 = path.join(longPath, 'file1');
	const filePath2 = path.join(longPath, 'file2');

	test('files with long pathnames added', createNewFilesFixture, {
		pkgFiles: ['*.js'],
		expected: {
			unpublished: [filePath1, filePath2],
			firstTime: [],
		},
	}, async ({t, $$}) => {
		await $$`git tag v0.0.0`;
		await t.context.createFile(filePath1);
		await t.context.createFile(filePath2);
		await $$`git add -A`;
		await $$`git commit -m "added"`;
	});
})();

test('no new files added', createNewFilesFixture, {
	pkgFiles: [],
	expected: {
		unpublished: [],
		firstTime: [],
	},
}, async ({$$}) => {
	await $$`git tag v0.0.0`;
});

test('ignores .git and .github files', createNewFilesFixture, {
	pkgFiles: ['*.js'],
	expected: {
		unpublished: [],
		firstTime: ['index.js'],
	},
}, async ({t, $$}) => {
	await $$`git tag v0.0.0`;
	await t.context.createFile('.github/workflows/main.yml');
	await t.context.createFile('.github/pull_request_template.md');
	await t.context.createFile('index.js');
	await $$`git add -A`;
	await $$`git commit -m "added"`;
});
