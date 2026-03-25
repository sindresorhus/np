import test from 'ava';
import {_createFixture} from '../_helpers/stub-execa.js';

/** @type {ReturnType<typeof _createFixture<import('../../source/git-util.js')>>} */
const createFixture = _createFixture('../../source/git-util.js', import.meta.url);

test('exists', createFixture, [{
	command: 'git ls-remote --tags origin v0.0.0',
	stdout: 'foobar\trefs/tags/v0.0.0',
}], async ({t, testedModule: {verifyTagDoesNotExistOnRemote}}) => {
	await t.throwsAsync(
		verifyTagDoesNotExistOnRemote('v0.0.0'),
		{message: 'Git tag `v0.0.0` already exists.'},
	);
});

test('does not exist', createFixture, [{
	command: 'git ls-remote --tags origin v0.0.0',
	stdout: '',
}], async ({t, testedModule: {verifyTagDoesNotExistOnRemote}}) => {
	await t.notThrowsAsync(verifyTagDoesNotExistOnRemote('v0.0.0'));
});

test('exists on custom remote', createFixture, [{
	command: 'git ls-remote --tags upstream v0.0.0',
	stdout: 'foobar\trefs/tags/v0.0.0',
}], async ({t, testedModule: {verifyTagDoesNotExistOnRemote}}) => {
	await t.throwsAsync(
		verifyTagDoesNotExistOnRemote('v0.0.0', 'upstream'),
		{message: 'Git tag `v0.0.0` already exists.'},
	);
});
