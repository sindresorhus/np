import test from 'ava';
import {SilentRenderer} from '../_helpers/listr-renderer.js';
import {_createFixture} from '../_helpers/stub-execa.js';
import {run, assertTaskFailed, assertTaskDoesntExist} from '../_helpers/listr.js';

/** @type {ReturnType<typeof _createFixture<import('../../source/git-tasks.js')>>} */
const createFixture = _createFixture('../../source/git-tasks.js', import.meta.url);

test.afterEach(() => {
	SilentRenderer.clearTasks();
});

test.serial('should fail when release branch is not specified, current branch is not the release branch, and publishing from any branch not permitted', createFixture, [{
	command: 'git symbolic-ref --short HEAD',
	stdout: 'feature',
}], async ({t, testedModule: gitTasks}) => {
	await t.throwsAsync(
		run(gitTasks({branch: 'master'})),
		{message: 'Not on `master` branch. Use --any-branch to publish anyway, or set a different release branch using --branch.'},
	);

	assertTaskFailed(t, 'Check current branch');
});

test.serial('should fail when current branch is not the specified release branch and publishing from any branch not permitted', createFixture, [{
	command: 'git symbolic-ref --short HEAD',
	stdout: 'feature',
}], async ({t, testedModule: gitTasks}) => {
	await t.throwsAsync(
		run(gitTasks({branch: 'release'})),
		{message: 'Not on `release` branch. Use --any-branch to publish anyway, or set a different release branch using --branch.'},
	);

	assertTaskFailed(t, 'Check current branch');
});

test.serial('should not fail when current branch not master and publishing from any branch permitted', createFixture, [
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
], async ({t, testedModule: gitTasks}) => {
	await t.notThrowsAsync(
		run(gitTasks({anyBranch: true})),
	);

	assertTaskDoesntExist(t, 'Check current branch');
});

test.serial('should fail when local working tree modified', createFixture, [
	{
		command: 'git symbolic-ref --short HEAD',
		stdout: 'master',
	},
	{
		command: 'git status --porcelain',
		stdout: 'M source/git-tasks.js',
	},
], async ({t, testedModule: gitTasks}) => {
	await t.throwsAsync(
		run(gitTasks({branch: 'master'})),
		{message: 'Unclean working tree. Commit or stash changes first.'},
	);

	assertTaskFailed(t, 'Check local working tree');
});

test.serial('should not fail when no remote set up', createFixture, [
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
], async ({t, testedModule: gitTasks}) => {
	await t.notThrowsAsync(
		run(gitTasks({branch: 'master'})),
	);
});

test.serial('should fail when remote history differs and changes are fetched', createFixture, [
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
], async ({t, testedModule: gitTasks}) => {
	await t.throwsAsync(
		run(gitTasks({branch: 'master'})),
		{message: 'Remote history differs. Please pull changes.'},
	);

	assertTaskFailed(t, 'Check remote history');
});

test.serial('should fail when remote has unfetched changes', createFixture, [
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
], async ({t, testedModule: gitTasks}) => {
	await t.throwsAsync(
		run(gitTasks({branch: 'master'})),
		{message: 'Remote history differs. Please run `git fetch` and pull changes.'},
	);

	assertTaskFailed(t, 'Check remote history');
});

test.serial('checks should pass when publishing from master, working tree is clean and remote history not different', createFixture, [
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
], async ({t, testedModule: gitTasks}) => {
	await t.notThrowsAsync(
		run(gitTasks({branch: 'master'})),
	);
});
