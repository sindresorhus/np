import assert from 'node:assert/strict';
import {_createFixture} from '../_helpers/stub-execa.js';

/**
@type {ReturnType<typeof createFixture<typeof import('../../source/git-util.js')>>}
*/
const createFixture = _createFixture('../../source/git-util.js', import.meta.url);

createFixture('succeeds', [{
	command: 'git push --follow-tags',
	exitCode: 0,
}], async ({
	testedModule: {pushGraceful},
}) => {
	await assert.doesNotReject(pushGraceful());
});

createFixture('fails w/ remote on GitHub and bad branch permission', [
	{
		command: 'git push --follow-tags',
		stderr: 'GH006',
	},
	{
		command: 'git push --tags',
		exitCode: 0,
	},
], async ({
	testedModule: {pushGraceful},
}) => {
	const {pushed, reason} = await pushGraceful(true);

	assert.equal(pushed, 'tags');
	assert.equal(reason, 'Branch protection: np can`t push the commits. Push them manually.');
});

createFixture('throws', [{
	command: 'git push --follow-tags',
	exitCode: 1,
}], async ({
	testedModule: {pushGraceful},
}) => {
	await assert.rejects(pushGraceful(false));
});

createFixture('propagates unrelated GitHub push errors', [{
	command: 'git push --follow-tags',
	stderr: 'remote: error: GH007: Your push would publish a private email address.',
}], async ({
	testedModule: {pushGraceful},
}) => {
	await assert.rejects(pushGraceful(true), {stderr: /GH007/v});
});

createFixture('pushes to custom remote', [{
	command: 'git push upstream --follow-tags',
	exitCode: 0,
}], async ({
	testedModule: {pushGraceful},
}) => {
	await assert.doesNotReject(pushGraceful(false, 'upstream'));
});

createFixture('throws with custom remote', [{
	command: 'git push upstream --follow-tags',
	exitCode: 1,
}], async ({
	testedModule: {pushGraceful},
}) => {
	await assert.rejects(pushGraceful(false, 'upstream'));
});

createFixture('pushes tags only to custom remote on branch protection error', [
	{
		command: 'git push upstream --follow-tags',
		stderr: 'GH006',
	},
	{
		command: 'git push upstream --tags',
		exitCode: 0,
	},
], async ({
	testedModule: {pushGraceful},
}) => {
	const {pushed, reason} = await pushGraceful(true, 'upstream');

	assert.equal(pushed, 'tags');
	assert.equal(reason, 'Branch protection: np can`t push the commits. Push them manually.');
});
