/* eslint-disable ava/no-ignored-test-files */
import process from 'node:process';
import path from 'node:path';
import fs from 'fs-extra';
import test from 'ava';
// Import esmock from 'esmock';
import {$} from 'execa';
import {temporaryDirectoryTask} from 'tempy';
import {writePackage} from 'write-pkg';
import * as util from '../source/util.js';

const createEmptyGitRepo = async ($$, temporaryDir) => {
	await $$`git init`;

	// `git tag` needs an initial commit
	await fs.createFile(path.resolve(temporaryDir, 'temp'));
	await $$`git add temp`;
	await $$`git commit -m "init1"`;
	await $$`git rm temp`;
	await $$`git commit -m "init2"`;
};

const createIntegrationTest = async (t, assertions) => {
	await temporaryDirectoryTask(async temporaryDir => {
		const $$ = $({cwd: temporaryDir});

		await createEmptyGitRepo($$, temporaryDir);
		process.chdir(temporaryDir);

		t.context.createFile = async file => fs.createFile(path.resolve(temporaryDir, file));
		await assertions($$, temporaryDir);
	});
};

test('main', async t => {
	await createIntegrationTest(t, async $$ => {
		await t.context.createFile('testFile');

		const {stdout} = await $$`git status -u`;

		t.true(
			stdout.includes('Untracked files') && stdout.includes('testFile'),
			'File wasn\'t created properly!',
		);
	});
});

const createFixture = test.macro(async (t, pkgFiles, commands, {unpublished, firstTime}) => {
	await createIntegrationTest(t, async ($$, temporaryDir) => {
		// /** @type {import('../source/util.js')} */
		// const util = await esmock('../source/util.js', {}, {
		// 	'node:process': {cwd: () => temporaryDir},
		// });

		const pkg = {
			name: 'foo',
			version: '0.0.0',
		};

		if (pkgFiles.length > 0) {
			pkg.files = pkgFiles;
		}

		await commands(t, $$, temporaryDir);
		await writePackage(temporaryDir, pkg);

		t.deepEqual(
			await util.getNewFiles(),
			{unpublished, firstTime},
		);
	});
});

test.serial('files to package with tags added', createFixture, ['*.js'], async (t, $$) => {
	await $$`git tag v0.0.0`;
	await t.context.createFile('new');
	await t.context.createFile('index.js');
	await $$`git add new index.js`;
	await $$`git commit -m "added"`;
}, {unpublished: ['new'], firstTime: ['index.js']});

test.serial('file `new` to package without tags added', createFixture, ['index.js'], async t => {
	await t.context.createFile('new');
	await t.context.createFile('index.js');
}, {unpublished: ['new'], firstTime: ['index.js', 'package.json']});

(() => { // Wrapper to have constants with macro
	const longPath = path.join('veryLonggggggDirectoryName', 'veryLonggggggDirectoryName');
	const filePath1 = path.join(longPath, 'file1');
	const filePath2 = path.join(longPath, 'file2');

	test.serial('files with long pathnames added', createFixture, ['*.js'], async (t, $$) => {
		await $$`git tag v0.0.0`;
		await t.context.createFile(filePath1);
		await t.context.createFile(filePath2);
		await $$`git add ${filePath1} ${filePath2}`;
		await $$`git commit -m "added"`;
	}, {unpublished: [filePath1, filePath2], firstTime: []});
})();

test.serial('no new files added', createFixture, [], async () => {
	await $`git tag v0.0.0`;
}, {unpublished: [], firstTime: []});
