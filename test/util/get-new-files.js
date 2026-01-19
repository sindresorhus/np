import path from 'node:path';
import test from 'ava';
import esmock from 'esmock';
import {execa} from 'execa';
import {writePackage} from 'write-package';
import {createIntegrationTest} from '../_helpers/integration-test.js';

const createNewFilesFixture = test.macro(async (t, input, commands) => {
	const {packageFiles, expected: {unpublished, firstTime}} = input;

	await createIntegrationTest(t, async ({$$, temporaryDirectory}) => {
		/** @type {import('../../source/util.js')} */
		const {getNewFiles} = await esmock('../../source/util.js', {}, {
			'node:process': {cwd: () => temporaryDirectory},
			execa: {execa: async (...arguments_) => execa(...arguments_, {cwd: temporaryDirectory})},
		});

		await commands({t, $$, temporaryDirectory});

		await writePackage(temporaryDirectory, {
			name: 'foo',
			version: '0.0.0',
			...packageFiles.length > 0 ? {files: packageFiles} : {},
		});

		const assertions = await t.try(async tt => {
			tt.deepEqual(
				await getNewFiles(temporaryDirectory),
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
	packageFiles: ['*.js'],
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
	packageFiles: ['index.js'],
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
		packageFiles: ['*.js'],
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
	packageFiles: [],
	expected: {
		unpublished: [],
		firstTime: [],
	},
}, async ({$$}) => {
	await $$`git tag v0.0.0`;
});

test('ignores .git and .github files', createNewFilesFixture, {
	packageFiles: ['*.js'],
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
