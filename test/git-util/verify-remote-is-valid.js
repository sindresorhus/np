import assert from 'node:assert/strict';
import {_createFixture as _createStubFixture} from '../_helpers/stub-execa.js';
import {_createFixture as _createIntegrationFixture} from '../_helpers/integration-test.js';

/**
@type {ReturnType<typeof createStubFixture<typeof import('../../source/git-util.js')>>}
*/
const createStubFixture = _createStubFixture('../../source/git-util.js', import.meta.url);

/**
@type {ReturnType<typeof createIntegrationFixture<typeof import('../../source/git-util.js')>>}
*/
const createIntegrationFixture = _createIntegrationFixture('../../source/git-util.js');

createStubFixture('has remote', [{
	command: 'git ls-remote origin HEAD',
	exitCode: 0,
}], async ({
	testedModule: {verifyRemoteIsValid},
}) => {
	await assert.doesNotReject(verifyRemoteIsValid());
});

createIntegrationFixture('no remote', async () => {
	//
}, async ({
	testedModule: {verifyRemoteIsValid},
}) => {
	await assert.rejects(
		verifyRemoteIsValid(),
		{message: /^Git fatal error:/mv},
	);
});

createStubFixture('timeout', [{
	command: 'git ls-remote origin HEAD',
	exitCode: 1,
	stderr: '',
	timedOut: true,
	shortMessage: 'Command timed out after 30000 milliseconds: git ls-remote origin HEAD',
}], async ({
	testedModule: {verifyRemoteIsValid},
}) => {
	await assert.rejects(
		verifyRemoteIsValid(),
		{message: 'Command timed out after 30000 milliseconds: git ls-remote origin HEAD', isPresentable: true},
	);
});

createStubFixture('has custom remote', [{
	command: 'git ls-remote upstream HEAD',
	exitCode: 0,
}], async ({
	testedModule: {verifyRemoteIsValid},
}) => {
	await assert.doesNotReject(verifyRemoteIsValid('upstream'));
});
