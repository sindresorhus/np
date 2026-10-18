import assert from 'node:assert/strict';
import test from 'node:test';
import {_createFixture} from '../_helpers/integration-test.js';

/**
@type {ReturnType<typeof createFixture<typeof import('../../source/git-util.js')>>}
*/
const createFixture = _createFixture('../../source/git-util.js');

createFixture('no tags', () => {
	//
}, async ({
	testedModule: {previousTagOrFirstCommit},
}) => {
	const result = await previousTagOrFirstCommit();
	assert.equal(result, undefined);
});

createFixture('one tag - fallback to first commit', async ({$$}) => {
	await $$`git tag v0.0.0`;
}, async ({context, testedModule: {previousTagOrFirstCommit}}) => {
	const result = await previousTagOrFirstCommit();
	const commitMessage = await context.getCommitMessage(result);

	assert.equal(commitMessage, context.firstCommitMessage);
});

createFixture('two tags', async ({context, $$}) => {
	await $$`git tag v0.0.0`;
	await context.commitNewFile();
	await $$`git tag v1.0.0`;
}, async ({
	testedModule: {previousTagOrFirstCommit},
}) => {
	const result = await previousTagOrFirstCommit();
	assert.equal(result, 'v0.0.0');
});

createFixture('multiple tags', async ({context, $$}) => {
	await $$`git tag v0.0.0`;
	/* eslint-disable no-await-in-loop -- sequential git tag creation requires ordered async execution */
	for (const major of [1, 2, 3, 4]) {
		await context.commitNewFile();
		await $$`git tag v${major}.0.0`;
	}
	/* eslint-enable no-await-in-loop */
}, async ({
	testedModule: {previousTagOrFirstCommit},
}) => {
	const result = await previousTagOrFirstCommit();
	assert.equal(result, 'v3.0.0');
});

createFixture(
	'tags created out of order - should sort by semver not creation date',
	async ({context, $$}) => {
		// Create tags out of semver order (simulating a hotfix scenario)
		await $$`git tag v1.0.0`;
		await context.commitNewFile();
		await $$`git tag v1.2.0`;
		await context.commitNewFile();
		await $$`git tag v1.2.1`;
		await context.commitNewFile();
		// Create a hotfix tag for an older version (created after v1.2.1 but semver is lower)
		await $$`git tag v1.0.1`;
		await context.commitNewFile();
		await $$`git tag v1.2.2`;
	},
	async ({
		testedModule: {previousTagOrFirstCommit},
	}) => {
		// Should return v1.2.1 (semver previous), not v1.0.1 (creation date previous)
		const result = await previousTagOrFirstCommit();
		assert.equal(result, 'v1.2.1');
	},
);

test.todo('test fallback case');

createFixture('sorts custom-prefix versions numerically and excludes unrelated previous-release candidates', async ({context, $$}) => {
	await $$`git tag release-1.9.0`;
	await context.commitNewFile();
	await $$`git tag release-1.10.0`;
	await $$`git tag other-1.10.1`;
	await $$`git tag v1.10.2`;
	await $$`git tag release-docs`;
	await context.commitNewFile();
	await $$`git tag release-1.11.0`;
}, async ({testedModule: {previousTagOrFirstCommit}}) => {
	assert.equal(await previousTagOrFirstCommit('release-'), 'release-1.10.0');
});

createFixture('a single custom-prefix release falls back to the first commit', async ({context, $$}) => {
	await context.commitNewFile();
	await $$`git tag release-1.0.0`;
}, async ({context, testedModule: {previousTagOrFirstCommit}}) => {
	const revision = await previousTagOrFirstCommit('release-');
	assert.equal(await context.getCommitMessage(revision), context.firstCommitMessage);
});

createFixture('does not treat another tag prefix as a published release', async ({$$}) => {
	await $$`git tag v1.0.0`;
}, async ({testedModule: {previousTagOrFirstCommit}}) => {
	assert.equal(await previousTagOrFirstCommit('release-'), undefined);
});
