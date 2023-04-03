import test from 'ava';
import {SilentRenderer} from './fixtures/listr-renderer.js';
import {
	_stubExeca,
	run,
	assertTaskFailed,
	assertTaskDoesntExist,
} from './_utils.js';

/** @type {(...args: ReturnType<_stubExeca>) => Promise<import('../source/git-tasks.js').default>} */
const stubExeca = _stubExeca('../source/git-tasks.js');

test.afterEach(() => {
	SilentRenderer.clearTasks();
});

test.serial('should fail when release branch is not specified, current branch is not the release branch, and publishing from any branch not permitted', async t => {
	const gitTasks = await stubExeca(t, [{
		command: 'git symbolic-ref --short HEAD',
		exitCode: 0,
		stdout: 'feature',
	}]);

	await t.throwsAsync(
		run(gitTasks({branch: 'master'})),
		{message: 'Not on `master` branch. Use --any-branch to publish anyway, or set a different release branch using --branch.'},
	);

	assertTaskFailed(t, 'Check current branch');
});

test.serial('should fail when current branch is not the specified release branch and publishing from any branch not permitted', async t => {
	const gitTasks = await stubExeca(t, [{
		command: 'git symbolic-ref --short HEAD',
		exitCode: 0,
		stdout: 'feature',
	}]);

	await t.throwsAsync(
		run(gitTasks({branch: 'release'})),
		{message: 'Not on `release` branch. Use --any-branch to publish anyway, or set a different release branch using --branch.'},
	);

	assertTaskFailed(t, 'Check current branch');
});

test.serial('should not fail when current branch not master and publishing from any branch permitted', async t => {
	const gitTasks = await stubExeca(t, [
		{
			command: 'git symbolic-ref --short HEAD',
			exitCode: 0,
			stdout: 'feature',
		},
		{
			command: 'git status --porcelain',
			exitCode: 0,
			stdout: '',
		},
		{
			command: 'git rev-list --count --left-only @{u}...HEAD',
			exitCode: 0,
			stdout: '',
		},
	]);

	await t.notThrowsAsync(
		run(gitTasks({anyBranch: true})),
	);

	assertTaskDoesntExist(t, 'Check current branch');
});

test.serial('should fail when local working tree modified', async t => {
	const gitTasks = await stubExeca(t, [
		{
			command: 'git symbolic-ref --short HEAD',
			exitCode: 0,
			stdout: 'master',
		},
		{
			command: 'git status --porcelain',
			exitCode: 0,
			stdout: 'M source/git-tasks.js',
		},
	]);

	await t.throwsAsync(
		run(gitTasks({branch: 'master'})),
		{message: 'Unclean working tree. Commit or stash changes first.'},
	);

	assertTaskFailed(t, 'Check local working tree');
});

test.serial('should fail when remote history differs', async t => {
	const gitTasks = await stubExeca(t, [
		{
			command: 'git symbolic-ref --short HEAD',
			exitCode: 0,
			stdout: 'master',
		},
		{
			command: 'git status --porcelain',
			exitCode: 0,
			stdout: '',
		},
		{
			command: 'git rev-list --count --left-only @{u}...HEAD',
			exitCode: 0,
			stdout: '1',
		},
	]);

	await t.throwsAsync(
		run(gitTasks({branch: 'master'})),
		{message: 'Remote history differs. Please pull changes.'},
	);

	assertTaskFailed(t, 'Check remote history');
});

test.serial('checks should pass when publishing from master, working tree is clean and remote history not different', async t => {
	const gitTasks = await stubExeca(t, [
		{
			command: 'git symbolic-ref --short HEAD',
			exitCode: 0,
			stdout: 'master',
		},
		{
			command: 'git status --porcelain',
			exitCode: 0,
			stdout: '',
		},
		{
			command: 'git rev-list --count --left-only @{u}...HEAD',
			exitCode: 0,
			stdout: '',
		},
	]);

	await t.notThrowsAsync(
		run(gitTasks({branch: 'master'})),
	);
});
