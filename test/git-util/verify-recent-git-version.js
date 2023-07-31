import test from 'ava';
import {_createFixture} from '../_helpers/stub-execa.js';

/** @type {ReturnType<typeof _createFixture<import('../../source/git-util.js')>>} */
const createFixture = _createFixture('../../source/git-util.js', import.meta.url);

test('satisfied', createFixture, [{
	command: 'git version',
	stdout: 'git version 2.12.0', // One higher than minimum
}], async ({t, testedModule: {verifyRecentGitVersion}}) => {
	await t.notThrowsAsync(
		verifyRecentGitVersion(),
	);
});

test('not satisfied', createFixture, [{
	command: 'git version',
	stdout: 'git version 2.10.0', // One lower than minimum
}], async ({t, testedModule: {verifyRecentGitVersion}}) => {
	await t.throwsAsync(
		verifyRecentGitVersion(),
		{message: '`np` requires git >=2.11.0'},
	);
});
