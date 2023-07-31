/* eslint-disable ava/no-ignored-test-files */
import path from 'node:path';
import fs from 'fs-extra';
import test from 'ava';
import esmock from 'esmock';
import {$, execa} from 'execa';
import {temporaryDirectoryTask} from 'tempy';

const createEmptyGitRepo = async ($$, temporaryDir) => {
	await $$`git init`;

	// `git tag` needs an initial commit
	await fs.createFile(path.resolve(temporaryDir, 'temp'));
	await $$`git add temp`;
	await $$`git commit -m "init1"`;
	await $$`git rm temp`;
	await $$`git commit -m "init2"`;
};

export const createIntegrationTest = async (t, assertions) => {
	await temporaryDirectoryTask(async temporaryDir => {
		const $$ = $({cwd: temporaryDir});

		await createEmptyGitRepo($$, temporaryDir);

		t.context.createFile = async (file, content = '') => fs.outputFile(path.resolve(temporaryDir, file), content);
		await assertions({$$, temporaryDir});
	});
};

export const _createFixture = source => test.macro(async (t, commands, assertions) => {
	await createIntegrationTest(t, async ({$$, temporaryDir}) => {
		const testedModule = await esmock(source, {}, {
			'node:process': {cwd: () => temporaryDir},
			execa: {execa: async (...args) => execa(...args, {cwd: temporaryDir})},
		});

		await commands({t, $$, temporaryDir});
		await assertions({t, testedModule, $$, temporaryDir});
	});
});
