import test from 'ava';
import {_createFixture} from '../_helpers/stub-execa.js';

/** @type {ReturnType<typeof _createFixture<import('../../source/git-util.js')>>} */
const createFixture = _createFixture('../../source/git-util.js', import.meta.url);

test('succeeds', createFixture, [{
	command: 'git push --follow-tags',
	exitCode: 0,
}], async ({t, testedModule: {pushGraceful}}) => {
	await t.notThrowsAsync(pushGraceful());
});

test('fails w/ remote on GitHub and bad branch permission', createFixture, [
	{
		command: 'git push --follow-tags',
		stderr: 'GH006',
	},
	{
		command: 'git push --tags',
		exitCode: 0,
	},
], async ({t, testedModule: {pushGraceful}}) => {
	const {pushed, reason} = await pushGraceful(true);

	t.is(pushed, 'tags');
	t.is(reason, 'Branch protection: np can`t push the commits. Push them manually.');
});

test('throws', createFixture, [{
	command: 'git push --follow-tags',
	exitCode: 1,
}], async ({t, testedModule: {pushGraceful}}) => {
	await t.throwsAsync(pushGraceful(false));
});

test('pushes to custom remote', createFixture, [{
	command: 'git push upstream --follow-tags',
	exitCode: 0,
}], async ({t, testedModule: {pushGraceful}}) => {
	await t.notThrowsAsync(pushGraceful(false, 'upstream'));
});

test('throws with custom remote', createFixture, [{
	command: 'git push upstream --follow-tags',
	exitCode: 1,
}], async ({t, testedModule: {pushGraceful}}) => {
	await t.throwsAsync(pushGraceful(false, 'upstream'));
});

test('pushes tags only to custom remote on branch protection error', createFixture, [
	{
		command: 'git push upstream --follow-tags',
		stderr: 'GH006',
	},
	{
		command: 'git push upstream --tags',
		exitCode: 0,
	},
], async ({t, testedModule: {pushGraceful}}) => {
	const {pushed, reason} = await pushGraceful(true, 'upstream');

	t.is(pushed, 'tags');
	t.is(reason, 'Branch protection: np can`t push the commits. Push them manually.');
});

