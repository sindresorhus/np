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
		command: 'git fetch',
		stderr: 'From https://github.com/sindresorhus/np', // Has unfetched changes
		exitCode: 0,
	},
	{
		command: 'git rev-list --count --left-right @{u}...HEAD',
		stdout: '1\t0',
	},
], async ({
	testedModule: {verifyRemoteHistoryIsClean},
}) => {
	await assert.rejects(
		verifyRemoteHistoryIsClean(),
		{message: 'Remote history differs. Please pull changes.', isBehind: true},
	);
});

createStubFixture('unclean remote history', [
	{
		command: 'git rev-parse @{u}',
		exitCode: 0,
	},
	{
		command: 'git fetch',
		exitCode: 0,
	},
	{
		command: 'git rev-list --count --left-right @{u}...HEAD',
		stdout: '1\t0', // Has unpulled changes
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
		command: 'git fetch',
		exitCode: 0,
	},
	{
		command: 'git rev-list --count --left-right @{u}...HEAD',
		stdout: '0\t0', // No changes
	},
], async ({
	testedModule: {verifyRemoteHistoryIsClean},
}) => {
	await assert.doesNotReject(verifyRemoteHistoryIsClean());
});

createStubFixture('accepts harmless fetch warnings when tracked history is current', [
	{
		command: 'git rev-parse @{u}',
		exitCode: 0,
	},
	{
		command: 'git fetch',
		stderr: 'warning: redirecting to https://example.com/new-location/',
		exitCode: 0,
	},
	{
		command: 'git rev-list --count --left-right @{u}...HEAD',
		stdout: '0\t0',
	},
], async ({testedModule: {verifyRemoteHistoryIsClean}}) => {
	await assert.doesNotReject(verifyRemoteHistoryIsClean());
});

createIntegrationFixture('no remote', async () => {
	//
}, async ({
	testedModule: {verifyRemoteHistoryIsClean},
}) => {
	await assert.doesNotReject(verifyRemoteHistoryIsClean());
});

createIntegrationFixture('rejects unfetched commits from the tracked remote', async ({$$}) => {
	await $$`git init --bare remote.git`;
	await $$`git remote add origin ./remote.git`;
	await $$`git push --set-upstream origin HEAD`;
	const {stdout: branch} = await $$`git branch --show-current`;
	await $$`git clone --branch ${branch} remote.git peer`;
	await $$`git -C peer commit --allow-empty -m remote-change`;
	await $$`git -C peer push`;
}, async ({
	testedModule: {verifyRemoteHistoryIsClean},
	$$,
}) => {
	const {stdout: upstreamBefore} = await $$`git rev-parse @{u}`;
	await assert.rejects(
		verifyRemoteHistoryIsClean(),
		{message: 'Remote history differs. Please pull changes.', isBehind: true},
	);
	const {stdout: upstreamAfter} = await $$`git rev-parse @{u}`;
	const {stdout: remoteHead} = await $$`git -C peer rev-parse HEAD`;
	assert.notEqual(upstreamAfter, upstreamBefore);
	assert.equal(upstreamAfter, remoteHead, 'The history check must refresh the tracked remote before comparing commits.');
});

createIntegrationFixture('accepts an up-to-date tracked remote', async ({$$}) => {
	await $$`git init --bare remote.git`;
	await $$`git remote add origin ./remote.git`;
	await $$`git push --set-upstream origin HEAD`;
}, async ({testedModule: {verifyRemoteHistoryIsClean}}) => {
	await assert.doesNotReject(verifyRemoteHistoryIsClean());
});

createIntegrationFixture('accepts unpublished local commits ahead of the tracked remote', async ({$$}) => {
	await $$`git init --bare remote.git`;
	await $$`git remote add origin ./remote.git`;
	await $$`git push --set-upstream origin HEAD`;
	await $$`git commit --allow-empty -m local-change`;
}, async ({testedModule: {verifyRemoteHistoryIsClean}, $$}) => {
	await assert.doesNotReject(verifyRemoteHistoryIsClean());
	const {stdout: ahead} = await $$`git rev-list --count @{u}..HEAD`;
	assert.equal(ahead, '1');
});

createIntegrationFixture('rejects diverged history even when local commits are unpublished', async ({$$}) => {
	await $$`git init --bare remote.git`;
	await $$`git remote add origin ./remote.git`;
	await $$`git push --set-upstream origin HEAD`;
	const {stdout: branch} = await $$`git branch --show-current`;
	await $$`git clone --branch ${branch} remote.git peer`;
	await $$`git -C peer commit --allow-empty -m remote-change`;
	await $$`git -C peer push`;
	await $$`git commit --allow-empty -m local-change`;
}, async ({testedModule: {verifyRemoteHistoryIsClean}, $$}) => {
	await assert.rejects(verifyRemoteHistoryIsClean(), {message: 'Local and remote history have diverged. Resolve the divergence before releasing.', isBehind: false});
	const {stdout: divergence} = await $$`git rev-list --count --left-right @{u}...HEAD`;
	assert.equal(divergence, '1\t1');
});

createIntegrationFixture('accepts remote updates unrelated to the tracked branch', async ({$$}) => {
	await $$`git init --bare remote.git`;
	await $$`git remote add origin ./remote.git`;
	await $$`git push --set-upstream origin HEAD`;
	const {stdout: branch} = await $$`git branch --show-current`;
	await $$`git clone --branch ${branch} remote.git peer`;
	await $$`git -C peer checkout -b another-branch`;
	await $$`git -C peer commit --allow-empty -m unrelated-change`;
	await $$`git -C peer push origin another-branch`;
}, async ({testedModule: {verifyRemoteHistoryIsClean}}) => {
	await assert.doesNotReject(verifyRemoteHistoryIsClean());
});
