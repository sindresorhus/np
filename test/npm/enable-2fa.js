import test from 'node:test';
import assert from 'node:assert/strict';
import sinon from 'sinon';
import esmock from 'esmock';
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

test('retries with the OTP when enabling 2FA requires one', async () => {
	const otpError = Object.assign(new Error('EOTP'), {stdout: '', stderr: 'npm error This operation requires a one-time password'});
	const execaStub = sinon.stub();
	execaStub.onFirstCall().rejects(otpError);
	execaStub.onSecondCall().resolves({});

	const handleNpmError = async (error, _task, executor) => {
		assert.equal(error, otpError);
		return executor('123456');
	};

	const {default: tryEnable2fa} = await esmock('../../source/npm/enable-2fa.js', {
		execa: {execa: execaStub},
		'../../source/npm/util.js': {
			version: async () => '10.0.0',
			npmNetworkTimeout: 15_000,
		},
		'../../source/npm/handle-npm-error.js': handleNpmError,
	});

	await tryEnable2fa({}, 'np', {});

	assert.deepEqual(execaStub.secondCall.args[1], ['access', 'set', 'mfa=publish', 'np', '--otp', '123456']);
});
