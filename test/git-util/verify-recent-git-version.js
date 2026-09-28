import assert from 'node:assert/strict';
import {_createFixture} from '../_helpers/stub-execa.js';

/**
@type {ReturnType<typeof createFixture<typeof import('../../source/git-util.js')>>}
*/
const createFixture = _createFixture('../../source/git-util.js', import.meta.url);

createFixture('satisfied', [{
	command: 'git version',
	stdout: 'git version 2.12.0', // One higher than minimum
}], async ({
	testedModule: {verifyRecentGitVersion},
}) => {
	await assert.doesNotReject(verifyRecentGitVersion());
});

createFixture('not satisfied', [{
	command: 'git version',
	stdout: 'git version 2.10.0', // One lower than minimum
}], async ({
	testedModule: {verifyRecentGitVersion},
}) => {
	await assert.rejects(
		verifyRecentGitVersion(),
		{message: '`np` requires git >=2.11.0'},
	);
});
