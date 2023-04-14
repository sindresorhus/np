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

// TODO: git-util.verifyTagDoesNotExistOnRemote - test when tagExistsOnRemote() errors

test('git-util.pushGraceful - succeeds', createFixture, [{
	command: 'git push --follow-tags',
	exitCode: 0,
}], async ({t, testedModule: git}) => {
	await t.notThrowsAsync(
		git.pushGraceful(),
	);
});

test('git-util.pushGraceful - fails w/ remote on GitHub and bad branch permission', createFixture, [
	{
		command: 'git push --follow-tags',
		stderr: 'GH006',
	},
	{
		command: 'git push --tags',
		exitCode: 0,
	},
], async ({t, testedModule: git}) => {
	const {pushed, reason} = await git.pushGraceful(true);

	t.is(pushed, 'tags');
	t.is(reason, 'Branch protection: np can`t push the commits. Push them manually.');
});

test('git-util.pushGraceful - throws', createFixture, [{
	command: 'git push --follow-tags',
	exitCode: 1,
}], async ({t, testedModule: git}) => {
	await t.throwsAsync(
		git.pushGraceful(false),
	);
});

test('git-util.verifyRecentGitVersion - satisfied', createFixture, [{
	command: 'git version',
	stdout: 'git version 2.12.0', // One higher than minimum
}], async ({t, testedModule: git}) => {
	await t.notThrowsAsync(
		git.verifyRecentGitVersion(),
	);
});

test('git-util.verifyRecentGitVersion - not satisfied', createFixture, [{
	command: 'git version',
	stdout: 'git version 2.10.0', // One lower than minimum
}], async ({t, testedModule: git}) => {
	await t.throwsAsync(
		git.verifyRecentGitVersion(),
		{message: '`np` requires git >=2.11.0'},
	);
});

