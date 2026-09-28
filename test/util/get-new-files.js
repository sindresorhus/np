import path from 'node:path';
import test from 'node:test';
import assert from 'node:assert/strict';
import esmock from 'esmock';
import {execa} from 'execa';
import {writePackage} from 'write-package';
import {createIntegrationTest} from '../_helpers/integration-test.js';

const createNewFilesFixture = (title, input, commands) => {
	test(title, async t => {
		const {packageFiles, expected: {unpublished, firstTime}} = input;

		await createIntegrationTest(t, async ({context, $$, temporaryDirectory}) => {
			/**
			@type {import('../../source/util.js')}
			*/
			const {getNewFiles} = await esmock('../../source/util.js', {}, {
				'node:process': {cwd: () => temporaryDirectory},
				execa: {execa: async (...arguments_) => execa(...arguments_, {cwd: temporaryDirectory})},
			});

			await commands({context, $$, temporaryDirectory});

			await writePackage(temporaryDirectory, {
				name: 'foo',
				version: '0.0.0',
				...((packageFiles.length > 0) && {files: packageFiles}),
			});

			let files;

			try {
				files = await getNewFiles(temporaryDirectory);
			} catch (error) {
				t.diagnostic('input:', input);
				throw error;
			}

			try {
				assert.deepEqual(files, {unpublished, firstTime});
			} catch (error) {
				t.diagnostic('input:', input);
				t.diagnostic('files:', files);
				throw error;
			}
		});
	});
};

createNewFilesFixture('files to package with tags added', {
	packageFiles: ['*.js'],
	expected: {
		unpublished: ['new'],
		firstTime: ['index.js'],
	},
}, async ({context, $$}) => {
	await $$`git tag v0.0.0`;
	await context.createFile('new');
	await context.createFile('index.js');
	await $$`git add -A`;
	await $$`git commit -m "added"`;
});

createNewFilesFixture('file `new` to package without tags added', {
	packageFiles: ['index.js'],
	expected: {
		unpublished: ['new'],
		firstTime: ['index.js', 'package.json'],
	},
}, async ({context}) => {
	await context.createFile('new');
	await context.createFile('index.js');
});

{ // Wrapper to have constants with macro
	const longPath = path.join('veryLonggggggDirectoryName', 'veryLonggggggDirectoryName');
	const filePath1 = path.join(longPath, 'file1');
	const filePath2 = path.join(longPath, 'file2');

	createNewFilesFixture('files with long pathnames added', {
		packageFiles: ['*.js'],
		expected: {
			unpublished: [filePath1, filePath2],
			firstTime: [],
		},
	}, async ({context, $$}) => {
		await $$`git tag v0.0.0`;
		await context.createFile(filePath1);
		await context.createFile(filePath2);
		await $$`git add -A`;
		await $$`git commit -m "added"`;
	});
}

createNewFilesFixture('no new files added', {
	packageFiles: [],
	expected: {
		unpublished: [],
		firstTime: [],
	},
}, async ({$$}) => {
	await $$`git tag v0.0.0`;
});

createNewFilesFixture('ignores .git and .github files', {
	packageFiles: ['*.js'],
	expected: {
		unpublished: [],
		firstTime: ['index.js'],
	},
}, async ({context, $$}) => {
	await $$`git tag v0.0.0`;
	await context.createFile('.github/workflows/main.yml');
	await context.createFile('.github/pull_request_template.md');
	await context.createFile('index.js');
	await $$`git add -A`;
	await $$`git commit -m "added"`;
});
