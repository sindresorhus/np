import assert from 'node:assert/strict';
import test from 'node:test';
import {SilentRenderer} from '../_helpers/listr-renderer.js';
import {_createFixture} from '../_helpers/stub-execa.js';
import {run, assertTaskFailed, assertTaskDoesntExist} from '../_helpers/listr.js';

/**
@type {ReturnType<typeof createFixture<typeof import('../../source/git-tasks.js')>>}
*/
const createFixture = _createFixture('../../source/git-tasks.js', import.meta.url);

test.afterEach(() => {
	SilentRenderer.clearTasks();
});

createFixture(
	'should fail when release branch is not specified, current branch is not the release branch, and publishing from any branch not permitted',
	[{
		command: 'git symbolic-ref --short HEAD',
		stdout: 'feature',
	}],
	async ({
		testedModule: gitTasks,
	}) => {
		await assert.rejects(
			run(gitTasks({branch: 'master'})),
			{message: 'Not on `master` branch. Use --any-branch to publish anyway, or set a different release branch using --branch.'},
		);

		assertTaskFailed('Check current branch');
	},
);

createFixture(
	'should fail when current branch is not the specified release branch and publishing from any branch not permitted',
	[{
		command: 'git symbolic-ref --short HEAD',
		stdout: 'feature',
	}],
	async ({
		testedModule: gitTasks,
	}) => {
		await assert.rejects(
			run(gitTasks({branch: 'release'})),
			{message: 'Not on `release` branch. Use --any-branch to publish anyway, or set a different release branch using --branch.'},
		);

		assertTaskFailed('Check current branch');
	},
);

createFixture(
	'should not fail when current branch not master and publishing from any branch permitted',
	[
		{
			command: 'git symbolic-ref --short HEAD',
			stdout: 'feature',
		},
		{
			command: 'git status --porcelain',
			stdout: '',
		},
		{
			command: 'git rev-parse @{u}',
			exitCode: 0,
		},
		{
			command: 'git fetch --dry-run',
			exitCode: 0,
		},
		{
			command: 'git rev-list --count --left-only @{u}...HEAD',
			stdout: '0',
		},
	],
	async ({
		testedModule: gitTasks,
	}) => {
		await assert.doesNotReject(run(gitTasks({anyBranch: true})));

		assertTaskDoesntExist('Check current branch');
	},
);

createFixture('should fail when local working tree modified', [
	{
		command: 'git symbolic-ref --short HEAD',
		stdout: 'master',
	},
	{
		command: 'git status --porcelain',
		stdout: 'M source/git-tasks.js',
	},
], async ({
	testedModule: gitTasks,
}) => {
	await assert.rejects(
		run(gitTasks({branch: 'master'})),
		{message: 'Unclean working tree. Commit or stash changes first.'},
	);

	assertTaskFailed('Check local working tree');
});

createFixture('should not fail when no remote set up', [
	{
		command: 'git symbolic-ref --short HEAD',
		stdout: 'master',
	},
	{
		command: 'git status --porcelain',
		stdout: '',
	},
	{
		command: 'git rev-parse @{u}',
		stderr: 'fatal: no upstream configured for branch \'master\'',
	},
], async ({
	testedModule: gitTasks,
}) => {
	await assert.doesNotReject(run(gitTasks({branch: 'master'})));
});

createFixture('should fail when remote history differs and changes are fetched', [
	{
		command: 'git symbolic-ref --short HEAD',
		stdout: 'master',
	},
	{
		command: 'git status --porcelain',
		stdout: '',
	},
	{
		command: 'git rev-parse @{u}',
		exitCode: 0,
	},
	{
		command: 'git fetch --dry-run',
		exitCode: 0,
	},
	{
		command: 'git rev-list --count --left-only @{u}...HEAD',
		stdout: '1', // Has unpulled changes
	},
], async ({
	testedModule: gitTasks,
}) => {
	await assert.rejects(
		run(gitTasks({branch: 'master'})),
		{message: 'Remote history differs. Please pull changes.'},
	);

	assertTaskFailed('Check remote history');
});

createFixture('should fail when remote has unfetched changes', [
	{
		command: 'git symbolic-ref --short HEAD',
		stdout: 'master',
	},
	{
		command: 'git status --porcelain',
		stdout: '',
	},
	{
		command: 'git rev-parse @{u}',
		exitCode: 0,
	},
	{
		command: 'git fetch --dry-run',
		stdout: 'From https://github.com/sindresorhus/np', // Has unfetched changes
	},
], async ({
	testedModule: gitTasks,
}) => {
	await assert.rejects(
		run(gitTasks({branch: 'master'})),
		{message: 'Remote history differs. Please run `git fetch` and pull changes.'},
	);

	assertTaskFailed('Check remote history');
});

createFixture(
	'checks should pass when publishing from master, working tree is clean and remote history not different',
	[
		{
			command: 'git symbolic-ref --short HEAD',
			stdout: 'master',
		},
		{
			command: 'git status --porcelain',
			stdout: '',
		},
		{
			command: 'git rev-parse @{u}',
			exitCode: 0,
		},
		{
			command: 'git fetch --dry-run',
			exitCode: 0,
		},
		{
			command: 'git rev-list --count --left-only @{u}...HEAD',
			stdout: '0',
		},
	],
	async ({
		testedModule: gitTasks,
	}) => {
		await assert.doesNotReject(run(gitTasks({branch: 'master'})));
	},
);

createFixture('preflight should validate remote before checking remote history', [
	{
		command: 'git symbolic-ref --short HEAD',
		stdout: 'master',
	},
	{
		command: 'git status --porcelain',
		stdout: '',
	},
	{
		command: 'git rev-parse @{u}',
		exitCode: 0,
	},
	{
		command: 'git config branch.master.remote',
		stdout: 'origin',
	},
	{
		command: 'git ls-remote origin HEAD',
		exitCode: 1,
		stderr: 'fatal: could not read from remote repository',
	},
], async ({
	testedModule,
}) => {
	await assert.rejects(
		testedModule.verifyGitTasks({branch: 'master'}),
		{message: 'Git fatal error: could not read from remote repository'},
	);
});

createFixture('preflight should skip upstream probe on detached head with anyBranch', [
	{
		command: 'git status --porcelain',
		stdout: '',
	},
	{
		command: 'git symbolic-ref --quiet HEAD',
		exitCode: 1,
	},
	{
		command: 'git rev-parse @{u}',
		stderr: 'fatal: no upstream configured for HEAD',
	},
], async ({
	testedModule,
}) => {
	await assert.doesNotReject(testedModule.verifyGitTasks({anyBranch: true}));
});

createFixture('preflight should validate explicit remote without upstream', [
	{
		command: 'git status --porcelain',
		stdout: '',
	},
	{
		command: 'git ls-remote upstream HEAD',
		exitCode: 1,
		stderr: 'fatal: remote upstream not found',
	},
], async ({
	testedModule,
}) => {
	await assert.rejects(
		testedModule.verifyGitTasks({anyBranch: true, remote: 'upstream'}),
		{message: 'Git fatal error: remote upstream not found'},
	);
});

createFixture('preflight should validate the tracked remote instead of origin', [
	{
		command: 'git symbolic-ref --short HEAD',
		stdout: 'main',
	},
	{
		command: 'git status --porcelain',
		stdout: '',
	},
	{
		command: 'git config branch.main.remote',
		stdout: 'upstream',
	},
	{
		command: 'git ls-remote upstream HEAD',
		exitCode: 0,
	},
	{
		command: 'git rev-parse @{u}',
		exitCode: 0,
	},
	{
		command: 'git fetch --dry-run',
		exitCode: 0,
	},
	{
		command: 'git rev-list --count --left-only @{u}...HEAD',
		stdout: '0',
	},
], async ({
	testedModule,
}) => {
	await assert.doesNotReject(testedModule.verifyGitTasks({branch: 'main'}));
});
