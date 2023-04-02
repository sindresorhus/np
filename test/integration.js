/* eslint-disable ava/no-ignored-test-files */
import process from 'node:process';
import path from 'node:path';
import fs from 'fs-extra';
import test from 'ava';
import {$} from 'execa';
import {deleteAsync} from 'del';
import * as gitUtil from '../source/git-util.js';
import * as util from '../source/util.js';

test.before(async t => {
	await fs.emptyDir('integration');
	process.chdir('integration');

	await $`git init`;
	await t.throwsAsync(gitUtil.latestTag(), undefined, 'prerequisites not met: repository should not contain any tags');

	await fs.createFile('temp');
	await $`git add .`;
	await $`git commit -m 'init'`;
	await deleteAsync('temp');
});

test.after.always(async () => {
	process.chdir('..');
	await deleteAsync('integration');
});

test.afterEach.always(async t => {
	if (typeof t.context.teardown === 'function') {
		await t.context.teardown();
	}
});

test.serial('files to package with tags added', async t => {
	await $`git tag v0.0.0`;
	await fs.createFile('new');
	await fs.createFile('index.js');
	await $`git add new index.js`;
	await $`git commit -m "added"`;

	t.context.teardown = async () => {
		await $`git rm new`;
		await $`git rm index.js`;
		await $`git tag -d v0.0.0`;
		await $`git commit -m "deleted"`;
	};

	t.deepEqual(
		await util.getNewFiles({files: ['*.js']}),
		{unpublished: ['new'], firstTime: ['index.js']}
	);
});

test.serial.failing('file `new` to package without tags added', async t => {
	await fs.createFile('new');
	await fs.createFile('index.js');

	t.context.teardown = async () => {
		await deleteAsync(['new', 'index.js']);
	};

	t.deepEqual(
		await util.getNewFiles({files: ['index.js']}),
		{unpublished: ['new'], firstTime: ['index.js']}
	);
});

test.serial('files with long pathnames added', async t => {
	const longPath = path.join('veryLonggggggDirectoryName', 'veryLonggggggDirectoryName');
	const filePath1 = path.join(longPath, 'file1');
	const filePath2 = path.join(longPath, 'file2');

	await $`git tag v0.0.0`;
	await fs.mkdir(longPath, {recursive: true});
	await fs.createFile(filePath1);
	await fs.createFile(filePath2);
	await $`git add ${filePath1} ${filePath2}`;
	await $`git commit -m "added"`;

	t.context.teardown = async () => {
		await $`git rm -r ${longPath}`;
		await $`git tag -d v0.0.0`;
		await $`git commit -m "deleted"`;
	};

	t.deepEqual(
		await util.getNewFiles({files: ['*.js']}),
		{unpublished: [filePath1, filePath2], firstTime: []}
	);
});

test.serial('no new files added', async t => {
	await $`git tag v0.0.0`;

	t.context.teardown = async () => {
		await $`git tag -d v0.0.0`;
	};

	t.deepEqual(
		await util.getNewFiles({files: ['*.js']}),
		{unpublished: [], firstTime: []}
	);
});
