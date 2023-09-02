import test from 'ava';
import {_createFixture} from '../_helpers/stub-execa.js';

/** @type {ReturnType<typeof _createFixture<import('../../source/git-util.js')>>} */
const createFixture = _createFixture('../../source/git-util.js', import.meta.url);

test('exists', createFixture, [{
	command: 'git rev-parse --quiet --verify refs/tags/v0.0.0',
	stdout: '123456789', // Some hash
}], async ({t, testedModule: {verifyTagDoesNotExistOnRemote}}) => {
	await t.throwsAsync(
		verifyTagDoesNotExistOnRemote('v0.0.0'),
		{message: 'Git tag `v0.0.0` already exists.'},
	);
});

test('does not exist', createFixture, [{
	command: 'git rev-parse --quiet --verify refs/tags/v0.0.0',
	exitCode: 1,
	stderr: '',
	stdout: '',
}], async ({t, testedModule: {verifyTagDoesNotExistOnRemote}}) => {
	await t.notThrowsAsync(
		verifyTagDoesNotExistOnRemote('v0.0.0'),
	);
});
