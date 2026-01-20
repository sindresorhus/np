import test from 'ava';
import {_createFixture} from '../_helpers/integration-test.js';

/** @type {ReturnType<typeof _createFixture<import('../../source/git-util.js')>>} */
const createFixture = _createFixture('../../source/git-util.js');

test('no tags', createFixture, () => {
	//
}, async ({t, testedModule: {previousTagOrFirstCommit}}) => {
	const result = await previousTagOrFirstCommit();
	t.is(result, undefined);
});

test('one tag - fallback to first commit', createFixture, async ({$$}) => {
	await $$`git tag v0.0.0`;
}, async ({t, testedModule: {previousTagOrFirstCommit}}) => {
	const result = await previousTagOrFirstCommit();
	const commitMessage = await t.context.getCommitMessage(result);

	t.is(commitMessage, t.context.firstCommitMessage);
});

test('two tags', createFixture, async ({t, $$}) => {
	await $$`git tag v0.0.0`;
	await t.context.commitNewFile();
	await $$`git tag v1.0.0`;
}, async ({t, testedModule: {previousTagOrFirstCommit}}) => {
	const result = await previousTagOrFirstCommit();
	t.is(result, 'v0.0.0');
});

test('multiple tags', createFixture, async ({t, $$}) => {
	await $$`git tag v0.0.0`;
	/* eslint-disable no-await-in-loop */
	for (const major of [1, 2, 3, 4]) {
		await t.context.commitNewFile();
		await $$`git tag v${major}.0.0`;
	}
	/* eslint-enable no-await-in-loop */
}, async ({t, testedModule: {previousTagOrFirstCommit}}) => {
	const result = await previousTagOrFirstCommit();
	t.is(result, 'v3.0.0');
});

test('tags created out of order - should sort by semver not creation date', createFixture, async ({t, $$}) => {
	// Create tags out of semver order (simulating a hotfix scenario)
	await $$`git tag v1.0.0`;
	await t.context.commitNewFile();
	await $$`git tag v1.2.0`;
	await t.context.commitNewFile();
	await $$`git tag v1.2.1`;
	await t.context.commitNewFile();
	// Create a hotfix tag for an older version (created after v1.2.1 but semver is lower)
	await $$`git tag v1.0.1`;
	await t.context.commitNewFile();
	await $$`git tag v1.2.2`;
}, async ({t, testedModule: {previousTagOrFirstCommit}}) => {
	// Should return v1.2.1 (semver previous), not v1.0.1 (creation date previous)
	const result = await previousTagOrFirstCommit();
	t.is(result, 'v1.2.1');
});

test.todo('test fallback case');
