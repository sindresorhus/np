import assert from 'node:assert/strict';
import {_createFixture} from '../_helpers/integration-test.js';

const createFixture = _createFixture('../../source/git-util.js');

createFixture('rejects untracked files hidden by status.showUntrackedFiles', async ({context, $$}) => {
	await $$`git config status.showUntrackedFiles no`;
	await context.createFile('new-module.js', 'export default 1;');
}, async ({testedModule: {verifyWorkingTreeIsClean}}) => {
	await assert.rejects(verifyWorkingTreeIsClean(), {message: 'Unclean working tree. Commit or stash changes first.'});
});

createFixture('still accepts ignored files when status.showUntrackedFiles is disabled', async ({context, $$}) => {
	await context.createFile('.gitignore', 'ignored.js\n');
	await $$`git add .gitignore`;
	await $$`git commit -m ignore-generated-file`;
	await $$`git config status.showUntrackedFiles no`;
	await context.createFile('ignored.js');
}, async ({testedModule: {verifyWorkingTreeIsClean}}) => {
	await assert.doesNotReject(verifyWorkingTreeIsClean());
});
