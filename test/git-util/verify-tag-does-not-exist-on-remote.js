import assert from 'node:assert/strict';
import {_createFixture} from '../_helpers/stub-execa.js';

/**
@type {ReturnType<typeof createFixture<typeof import('../../source/git-util.js')>>}
*/
const createFixture = _createFixture('../../source/git-util.js', import.meta.url);

createFixture('exists', [{
	command: 'git rev-parse --quiet --verify refs/tags/v0.0.0',
	stdout: '123456789', // Some hash
}], async ({
	testedModule: {verifyTagDoesNotExistOnRemote},
}) => {
	await assert.rejects(
		verifyTagDoesNotExistOnRemote('v0.0.0'),
		{message: 'Git tag `v0.0.0` already exists.'},
	);
});

createFixture('does not exist', [{
	command: 'git rev-parse --quiet --verify refs/tags/v0.0.0',
	exitCode: 1,
	stderr: '',
	stdout: '',
}], async ({
	testedModule: {verifyTagDoesNotExistOnRemote},
}) => {
	await assert.doesNotReject(verifyTagDoesNotExistOnRemote('v0.0.0'));
});
