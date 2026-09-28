import crypto from 'node:crypto';
import os from 'node:os';
import path from 'node:path';
import {test} from 'node:test';
import fs from 'fs-extra';
import esmock from 'esmock';
import {$, execa} from 'execa';

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

const createTemporaryDirectory = async t => {
	// `os.tmpdir()` can be a symlink (`/var` -> `/private/var` on macOS). `git` reports the
	// resolved path, so resolve up front to keep every comparison in these tests consistent.
	const created = await fs.mkdtemp(path.join(os.tmpdir(), 'np-test-'));
	const temporaryDirectory = await fs.realpath(created);
	t.after(async () => {
		await fs.remove(temporaryDirectory);
	});

	return temporaryDirectory;
};

export const createIntegrationTest = async (t, assertions) => {
	const temporaryDirectory = await createTemporaryDirectory(t);
	const $$ = $({cwd: temporaryDirectory});

	const firstCommitMessage = await createEmptyGitRepo($$, temporaryDirectory);

	// From https://stackoverflow.com/a/3357357/10292952
	const getCommitMessage = async sha => {
		const {stdout: commitMessage} = await $$`git log --format=%B -n 1 ${sha}`;
		return commitMessage.trim();
	};

	const createFile = async (file, content = '') => fs.outputFile(path.resolve(temporaryDirectory, file), content);

	const commitNewFile = async () => {
		await createFile(`new-${crypto.randomUUID()}`);
		await $$`git add .`;
		await $$`git commit -m "added"`;

		const {stdout: lastCommitSha} = await $$`git rev-parse --short HEAD`;

		return {
			sha: lastCommitSha,
			commitMessage: await getCommitMessage(lastCommitSha),
		};
	};

	const context = {
		firstCommitMessage,
		getCommitMessage,
		createFile,
		commitNewFile,
	};

	await assertions({context, $$, temporaryDirectory});
};

export const _createFixture = source => (title, commands, assertions) => test(title, async t => {
	await createIntegrationTest(t, async ({context, $$, temporaryDirectory}) => {
		const testedModule = await esmock(source, {}, {
			'node:process': {cwd: () => temporaryDirectory},
			execa: {execa: async (command, commandArguments, options = {}) => execa(command, commandArguments, {...options, cwd: temporaryDirectory})},
		});

		await commands({context, $$, temporaryDirectory});
		await assertions({
			context, testedModule, $$, temporaryDirectory,
		});
	});
});
