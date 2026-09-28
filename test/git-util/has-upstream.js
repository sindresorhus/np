import assert from 'node:assert/strict';
import {_createFixture} from '../_helpers/integration-test.js';

/**
@type {ReturnType<typeof _createFixture<typeof import("../../source/git-util.js")>>}
*/
const createFixture = _createFixture('../../source/git-util.js');

createFixture('no upstream', async () => {
	//
}, async ({
	testedModule: {hasUpstream},
}) => {
	assert.ok(!(await hasUpstream()));
});

createFixture('has upstream', async ({$$}) => {
	await $$`git init --bare remote.git`;
	await $$`git remote add origin ./remote.git`;
	await $$`git push --set-upstream origin HEAD`;
}, async ({
	testedModule: {hasUpstream},
}) => {
	assert.ok(await hasUpstream());
});

createFixture('upstream branch has a different name', async ({$$}) => {
	await $$`git init --bare remote.git`;
	await $$`git remote add origin ./remote.git`;
	await $$`git push origin HEAD:refs/heads/trunk`;
	await $$`git branch --set-upstream-to=origin/trunk`;
}, async ({
	testedModule: {hasUpstream},
}) => {
	assert.ok(await hasUpstream());
});

createFixture('detached head', async ({$$}) => {
	await $$`git checkout --detach`;
}, async ({
	testedModule: {hasUpstream},
}) => {
	assert.ok(!(await hasUpstream()));
});
