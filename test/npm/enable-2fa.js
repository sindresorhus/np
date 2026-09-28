import assert from 'node:assert/strict';
import {_createFixture} from '../_helpers/stub-execa.js';

/**
@type {ReturnType<typeof createFixture<typeof import('../../source/npm/enable-2fa.js')>>}
*/
const createFixture = _createFixture('../../source/npm/enable-2fa.js', import.meta.url);

const npmVersionFixtures = [
	{version: '8.0.0', accessArgs: ['access', '2fa-required']},
	{version: '9.0.0', accessArgs: ['access', 'set', 'mfa=publish']},
];

for (const {version, accessArgs} of npmVersionFixtures) {
	const npmVersionCommand = [{
		command: 'npm --version',
		stdout: version,
	}];

	createFixture(
		`npm v${version} - no options`,
		npmVersionCommand,
		async ({
			testedModule: {getEnable2faArguments},
		}) => {
			assert.deepEqual(
				await getEnable2faArguments('np'),
				[...accessArgs, 'np'],
			);
		},
	);

	createFixture(
		`npm v${version} - options, no otp`,
		npmVersionCommand,
		async ({
			testedModule: {getEnable2faArguments},
		}) => {
			assert.deepEqual(
				await getEnable2faArguments('np', {confirm: true}),
				[...accessArgs, 'np'],
			);
		},
	);

	createFixture(
		`npm v${version} - options, with otp`,
		npmVersionCommand,
		async ({
			testedModule: {getEnable2faArguments},
		}) => {
			assert.deepEqual(
				await getEnable2faArguments('np', {otp: '123456'}),
				[...accessArgs, 'np', '--otp', '123456'],
			);
		},
	);
}
