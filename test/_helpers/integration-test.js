/* eslint-disable ava/no-ignored-test-files */
import crypto from 'node:crypto';
import path from 'node:path';
import fs from 'fs-extra';
import test from 'ava';
import esmock from 'esmock';
import {$, execa} from 'execa';
import {temporaryDirectoryTask} from 'tempy';

const createEmptyGitRepo = async ($$, temporaryDir) => {
	const firstCommitMessage = '"init1"';

	await $$`git init`;

	// `git tag` needs an initial commit
	await fs.createFile(path.resolve(temporaryDir, 'temp'));
	await $$`git add temp`;
	await $$`git commit -m ${firstCommitMessage}`;
	await $$`git rm temp`;
	await $$`git commit -m "init2"`;

	return firstCommitMessage;
};

export const createIntegrationTest = async (t, assertions) => {
	await temporaryDirectoryTask(async temporaryDir => {
		const $$ = $({cwd: temporaryDir});

		t.context.firstCommitMessage = await createEmptyGitRepo($$, temporaryDir);

		// From https://stackoverflow.com/a/3357357/10292952
		t.context.getCommitMessage = async sha => {
			const {stdout: commitMessage} = await $$`git log --format=%B -n 1 ${sha}`;
			return commitMessage.trim();
		};

		t.context.createFile = async (file, content = '') => fs.outputFile(path.resolve(temporaryDir, file), content);

		t.context.commitNewFile = async () => {
			await t.context.createFile(`new-${crypto.randomUUID()}`);
			await $$`git add .`;
			await $$`git commit -m "added"`;

			const {stdout: lastCommitSha} = await $$`git rev-parse --short HEAD`;

			return {
				sha: lastCommitSha,
				commitMessage: await t.context.getCommitMessage(lastCommitSha),
			};
		};

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
