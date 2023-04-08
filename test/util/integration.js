import path from 'node:path';
import test from 'ava';
import esmock from 'esmock';
import {execa} from 'execa';
import {writePackage} from 'write-pkg';
import {createIntegrationTest} from '../_helpers/integration-test.js';

const createNewFilesFixture = test.macro(async (t, pkgFiles, commands, {unpublished, firstTime}) => {
	await createIntegrationTest(t, async ($$, temporaryDir) => {
		/** @type {import('../../source/util.js')} */
		const util = await esmock('../../source/util.js', {}, {
			'node:process': {cwd: () => temporaryDir},
			execa: {execa: async (...args) => execa(...args, {cwd: temporaryDir})},
		});

		await commands(t, $$, temporaryDir);

		await writePackage(temporaryDir, {
			name: 'foo',
			version: '0.0.0',
			...pkgFiles.length > 0 ? {files: pkgFiles} : {},
		});

		t.deepEqual(
			await util.getNewFiles(temporaryDir),
			{unpublished, firstTime},
		);
	});
});

test('files to package with tags added', createNewFilesFixture, ['*.js'], async (t, $$) => {
	await $$`git tag v0.0.0`;
	await t.context.createFile('new');
	await t.context.createFile('index.js');
	await $$`git add -A`;
	await $$`git commit -m "added"`;
}, {unpublished: ['new'], firstTime: ['index.js']});

test('file `new` to package without tags added', createNewFilesFixture, ['index.js'], async t => {
	await t.context.createFile('new');
	await t.context.createFile('index.js');
}, {unpublished: ['new'], firstTime: ['index.js', 'package.json']});

(() => { // Wrapper to have constants with macro
	const longPath = path.join('veryLonggggggDirectoryName', 'veryLonggggggDirectoryName');
	const filePath1 = path.join(longPath, 'file1');
	const filePath2 = path.join(longPath, 'file2');

	test('files with long pathnames added', createNewFilesFixture, ['*.js'], async (t, $$) => {
		await $$`git tag v0.0.0`;
		await t.context.createFile(filePath1);
		await t.context.createFile(filePath2);
		await $$`git add -A`;
		await $$`git commit -m "added"`;
	}, {unpublished: [filePath1, filePath2], firstTime: []});
})();

test('no new files added', createNewFilesFixture, [], async (_t, $$) => {
	await $$`git tag v0.0.0`;
}, {unpublished: [], firstTime: []});

test('ignores .git and .github files', createNewFilesFixture, ['*.js'], async (t, $$) => {
	await $$`git tag v0.0.0`;
	await t.context.createFile('.github/workflows/main.yml');
	await t.context.createFile('.github/pull_request_template');
	await t.context.createFile('index.js');
	await $$`git add -A`;
	await $$`git commit -m "added"`;
}, {unpublished: [], firstTime: ['index.js']});
