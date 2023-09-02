import test from 'ava';
import {_createFixture as _createStubFixture} from '../_helpers/stub-execa.js';
import {_createFixture as _createIntegrationFixture} from '../_helpers/integration-test.js';

/** @type {ReturnType<typeof _createStubFixture<import('../../source/git-util.js')>>} */
const createStubFixture = _createStubFixture('../../source/git-util.js', import.meta.url);

/** @type {ReturnType<typeof _createIntegrationFixture<import('../../source/git-util.js')>>} */
const createIntegrationFixture = _createIntegrationFixture('../../source/git-util.js');

test('has remote', createStubFixture, [{
	command: 'git ls-remote origin HEAD',
	exitCode: 0,
}], async ({t, testedModule: {verifyRemoteIsValid}}) => {
	await t.notThrowsAsync(
		verifyRemoteIsValid(),
	);
});

test('no remote', createIntegrationFixture, async () => {
	//
}, async ({t, testedModule: {verifyRemoteIsValid}}) => {
	await t.throwsAsync(
		verifyRemoteIsValid(),
		{message: /^Git fatal error:/m},
	);
});
