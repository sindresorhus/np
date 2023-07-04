import test from 'ava';
import {_createFixture} from '../_helpers/stub-execa.js';

/** @type {ReturnType<typeof _createFixture<import('../../source/npm/enable-2fa.js')>>} */
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

	test(`npm v${version} - no options`, createFixture, npmVersionCommand,
		async ({t, testedModule: {getEnable2faArgs}}) => {
			t.deepEqual(
				await getEnable2faArgs('np'),
				[...accessArgs, 'np'],
			);
		},
	);

	test(`npm v${version} - options, no otp`, createFixture, npmVersionCommand,
		async ({t, testedModule: {getEnable2faArgs}}) => {
			t.deepEqual(
				await getEnable2faArgs('np', {confirm: true}),
				[...accessArgs, 'np'],
			);
		},
	);

	test(`npm v${version} - options, with otp`, createFixture, npmVersionCommand,
		async ({t, testedModule: {getEnable2faArgs}}) => {
			t.deepEqual(
				await getEnable2faArgs('np', {otp: '123456'}),
				[...accessArgs, 'np', '--otp', '123456'],
			);
		},
	);
}

