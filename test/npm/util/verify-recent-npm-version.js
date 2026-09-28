import assert from 'node:assert/strict';
import {_createFixture} from '../../_helpers/stub-execa.js';

/**
@type {ReturnType<typeof createFixture<typeof import('../../../source/npm/util.js')>>}
*/
const createFixture = _createFixture('../../../source/npm/util.js', import.meta.url);

createFixture('satisfied', [{
	command: 'npm --version',
	stdout: '99.20.0', // Higher than minimum
}], async ({
	testedModule: npm,
}) => {
	await assert.doesNotReject(npm.verifyRecentNpmVersion());
});

createFixture('not satisfied', [{
	command: 'npm --version',
	stdout: '5.18.0', // Lower than minimum
}], async ({
	testedModule: npm,
}) => {
	await assert.rejects(
		npm.verifyRecentNpmVersion(),
		{message: /`np` requires npm >=/v},
	);
});
