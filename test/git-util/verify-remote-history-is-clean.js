import assert from 'node:assert/strict';
import {_createFixture as _createStubFixture} from '../_helpers/stub-execa.js';
import {_createFixture as _createIntegrationFixture} from '../_helpers/integration-test.js';

/**
@type {ReturnType<typeof createStubFixture<typeof import('../../source/git-util.js')>>}
*/
const createStubFixture = _createStubFixture('../../source/git-util.js', import.meta.url);

/**
@type {ReturnType<typeof createIntegrationFixture<typeof import('../../source/git-util.js')>>}
*/
const createIntegrationFixture = _createIntegrationFixture('../../source/git-util.js');

createStubFixture('unfetched changes', [
	{
		command: 'git rev-parse @{u}',
		exitCode: 0,
	},
	{
		command: 'git fetch --dry-run',
		stdout: 'From https://github.com/sindresorhus/np', // Has unfetched changes
	},
], async ({
	testedModule: {verifyRemoteHistoryIsClean},
}) => {
	await assert.rejects(
		verifyRemoteHistoryIsClean(),
		{message: 'Remote history differs. Please run `git fetch` and pull changes.'},
	);
});

createStubFixture('unclean remote history', [
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
	testedModule: {verifyRemoteHistoryIsClean},
}) => {
	await assert.rejects(
		verifyRemoteHistoryIsClean(),
		{message: 'Remote history differs. Please pull changes.'},
	);
});

createStubFixture('clean fetched remote history', [
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
], async ({
	testedModule: {verifyRemoteHistoryIsClean},
}) => {
	await assert.doesNotReject(verifyRemoteHistoryIsClean());
});

createIntegrationFixture('no remote', async () => {
	//
}, async ({
	testedModule: {verifyRemoteHistoryIsClean},
}) => {
	await assert.doesNotReject(verifyRemoteHistoryIsClean());
});
