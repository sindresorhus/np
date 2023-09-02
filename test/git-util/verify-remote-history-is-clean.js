import test from 'ava';
import {_createFixture as _createStubFixture} from '../_helpers/stub-execa.js';
import {_createFixture as _createIntegrationFixture} from '../_helpers/integration-test.js';

/** @type {ReturnType<typeof _createStubFixture<import('../../source/git-util.js')>>} */
const createStubFixture = _createStubFixture('../../source/git-util.js', import.meta.url);

/** @type {ReturnType<typeof _createIntegrationFixture<import('../../source/git-util.js')>>} */
const createIntegrationFixture = _createIntegrationFixture('../../source/git-util.js');

test('unfetched changes', createStubFixture, [
	{
		command: 'git rev-parse @{u}',
		exitCode: 0,
	},
	{
		command: 'git fetch --dry-run',
		stdout: 'From https://github.com/sindresorhus/np', // Has unfetched changes
	},
], async ({t, testedModule: {verifyRemoteHistoryIsClean}}) => {
	await t.throwsAsync(
		verifyRemoteHistoryIsClean(),
		{message: 'Remote history differs. Please run `git fetch` and pull changes.'},
	);
});

test('unclean remote history', createStubFixture, [
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
], async ({t, testedModule: {verifyRemoteHistoryIsClean}}) => {
	await t.throwsAsync(
		verifyRemoteHistoryIsClean(),
		{message: 'Remote history differs. Please pull changes.'},
	);
});

test('clean fetched remote history', createStubFixture, [
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
], async ({t, testedModule: {verifyRemoteHistoryIsClean}}) => {
	await t.notThrowsAsync(
		verifyRemoteHistoryIsClean(),
	);
});

test('no remote', createIntegrationFixture, async () => {
	//
}, async ({t, testedModule: {verifyRemoteHistoryIsClean}}) => {
	const result = await t.notThrowsAsync(
		verifyRemoteHistoryIsClean(),
	);

	t.is(result, undefined);
});
