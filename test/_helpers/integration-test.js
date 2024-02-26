/* eslint-disable ava/no-ignored-test-files */
import crypto from 'node:crypto';
import path from 'node:path';
import fs from 'fs-extra';
import test from 'ava';
import esmock from 'esmock';
import {$, execa} from 'execa';
import {temporaryDirectoryTask} from 'tempy';

const createEmptyGitRepo = async ($$, temporaryDirectory) => {
	const firstCommitMessage = '"init1"';

	await $$`git init`;

	// `git tag` needs an initial commit
	await fs.createFile(path.resolve(temporaryDirectory, 'temp'));
	await $$`git add temp`;
	await $$`git commit -m ${firstCommitMessage}`;
	await $$`git rm temp`;
	await $$`git commit -m "init2"`;

	return firstCommitMessage;
};

export const createIntegrationTest = async (t, assertions) => {
	await temporaryDirectoryTask(async temporaryDirectory => {
		const $$ = $({cwd: temporaryDirectory});

		t.context.firstCommitMessage = await createEmptyGitRepo($$, temporaryDirectory);

		// From https://stackoverflow.com/a/3357357/10292952
		t.context.getCommitMessage = async sha => {
			const {stdout: commitMessage} = await $$`git log --format=%B -n 1 ${sha}`;
			return commitMessage.trim();
		};

		t.context.createFile = async (file, content = '') => fs.outputFile(path.resolve(temporaryDirectory, file), content);

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

		await assertions({$$, temporaryDirectory});
	});
};

export const _createFixture = source => test.macro(async (t, commands, assertions) => {
	await createIntegrationTest(t, async ({$$, temporaryDirectory}) => {
		const testedModule = await esmock(source, {}, {
			'node:process': {cwd: () => temporaryDirectory},
			execa: {execa: async (...arguments_) => execa(...arguments_, {cwd: temporaryDirectory})},
		});

		await commands({t, $$, temporaryDirectory});
		await assertions({
			t, testedModule, $$, temporaryDirectory,
		});
	});
});
