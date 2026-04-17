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
	await t.notThrowsAsync(run(gitTasks({anyBranch: true})));

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
	await t.notThrowsAsync(run(gitTasks({branch: 'master'})));
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
	await t.notThrowsAsync(run(gitTasks({branch: 'master'})));
});

test.serial('preflight should validate remote before checking remote history', createFixture, [
	{
		command: 'git symbolic-ref --short HEAD',
		stdout: 'master',
	},
	{
		command: 'git status --porcelain',
		stdout: '',
	},
	{
		command: 'git status --short --branch --porcelain',
		stdout: '## master...origin/master',
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
], async ({t, testedModule}) => {
	await t.throwsAsync(
		testedModule.verifyGitTasks({branch: 'master'}),
		{message: 'Git fatal error: could not read from remote repository'},
	);
});

test.serial('preflight should skip upstream probe on detached head with anyBranch', createFixture, [
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
], async ({t, testedModule}) => {
	await t.notThrowsAsync(testedModule.verifyGitTasks({anyBranch: true}));
});

test.serial('preflight should validate explicit remote without upstream', createFixture, [
	{
		command: 'git status --porcelain',
		stdout: '',
	},
	{
		command: 'git ls-remote upstream HEAD',
		exitCode: 1,
		stderr: 'fatal: remote upstream not found',
	},
], async ({t, testedModule}) => {
	await t.throwsAsync(
		testedModule.verifyGitTasks({anyBranch: true, remote: 'upstream'}),
		{message: 'Git fatal error: remote upstream not found'},
	);
});

test.serial('preflight should validate the tracked remote instead of origin', createFixture, [
	{
		command: 'git symbolic-ref --short HEAD',
		stdout: 'main',
	},
	{
		command: 'git status --porcelain',
		stdout: '',
	},
	{
		command: 'git status --short --branch --porcelain',
		stdout: '## main...upstream/main',
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
], async ({t, testedModule}) => {
	await t.notThrowsAsync(testedModule.verifyGitTasks({branch: 'main'}));
});
