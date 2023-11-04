import test from 'ava';
import {_createFixture} from '../../_helpers/stub-execa.js';

/** @type {ReturnType<typeof _createFixture<import('../../../source/npm/util.js')>>} */
const createFixture = _createFixture('../../../source/npm/util.js', import.meta.url);

test('satisfied', createFixture, [{
	command: 'npm --version',
	stdout: '99.20.0', // Higher than minimum
}], async ({t, testedModule: npm}) => {
	await t.notThrowsAsync(
		npm.verifyRecentNpmVersion(),
	);
});

test('not satisfied', createFixture, [{
	command: 'npm --version',
	stdout: '5.18.0', // Lower than minimum
}], async ({t, testedModule: npm}) => {
	await t.throwsAsync(
		npm.verifyRecentNpmVersion(),
		{message: /`np` requires npm >=/},
	);
});
