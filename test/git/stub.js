import test from 'ava';
import {_createFixture} from '../_helpers/stub-execa.js';

/** @type {ReturnType<typeof _createFixture<import('../../source/git-util.js')>>} */
const createFixture = _createFixture('../../source/git-util.js', import.meta.url);

test('git-util.verifyRemoteHistoryIsClean - unfetched changes', createFixture, [
	{
		command: 'git rev-parse @{u}',
		exitCode: 0,
	},
	{
		command: 'git fetch --dry-run',
		stdout: 'From https://github.com/sindresorhus/np', // Has unfetched changes
	},
], async ({t, testedModule: git}) => {
	await t.throwsAsync(
		git.verifyRemoteHistoryIsClean(),
		{message: 'Remote history differs. Please run `git fetch` and pull changes.'},
	);
});

test('git-util.verifyRemoteHistoryIsClean - unclean remote history', createFixture, [
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
], async ({t, testedModule: git}) => {
	await t.throwsAsync(
		git.verifyRemoteHistoryIsClean(),
		{message: 'Remote history differs. Please pull changes.'},
	);
});

test('git-util.verifyRemoteHistoryIsClean - clean fetched remote history', createFixture, [
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
		stdout: '0', // No changes
	},
], async ({t, testedModule: git}) => {
	await t.notThrowsAsync(
		git.verifyRemoteHistoryIsClean(),
	);
});

test('git-util.verifyRemoteIsValid - has remote', createFixture, [{
	command: 'git ls-remote origin HEAD',
	exitCode: 0,
}], async ({t, testedModule: git}) => {
	await t.notThrowsAsync(
		git.verifyRemoteIsValid(),
	);
});

test('git-util.verifyTagDoesNotExistOnRemote - exists', createFixture, [{
	command: 'git rev-parse --quiet --verify refs/tags/v0.0.0',
	stdout: '123456789', // Some hash
}], async ({t, testedModule: git}) => {
	await t.throwsAsync(
		git.verifyTagDoesNotExistOnRemote('v0.0.0'),
		{message: 'Git tag `v0.0.0` already exists.'},
	);
});

test('git-util.verifyTagDoesNotExistOnRemote - does not exist', createFixture, [{
	command: 'git rev-parse --quiet --verify refs/tags/v0.0.0',
	exitCode: 1,
	stderr: '',
	stdout: '',
}], async ({t, testedModule: git}) => {
	await t.notThrowsAsync(
		git.verifyTagDoesNotExistOnRemote('v0.0.0'),
	);
});

test('git-util.verifyRecentGitVersion - satisfies', createFixture, [{
	command: 'git version',
	stdout: 'git version 2.12.0',
}], async ({t, testedModule: git}) => {
	await t.notThrowsAsync(
		git.verifyRecentGitVersion(),
	);
});

test('git-util.verifyRecentGitVersion - not satisfied', createFixture, [{
	command: 'git version',
	stdout: 'git version 2.10.0',
}], async ({t, testedModule: git}) => {
	await t.throwsAsync(
		git.verifyRecentGitVersion(),
		{message: 'Please upgrade to git>=2.11.0'}, // TODO: add space to error message?
	);
});

