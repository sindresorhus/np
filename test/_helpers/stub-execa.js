/* eslint-disable ava/no-ignored-test-files */
import test from 'ava';
import esmock from 'esmock';
import sinon from 'sinon';
import {execa} from 'execa';

const makeExecaStub = commands => {
	const stub = sinon.stub();

	for (const result of commands) {
		const [command, ...commandArgs] = result.command.split(' ');

		// Command passes if the exit code is 0, or if there's no exit code and no stderr.
		const passes = result.exitCode === 0 || (!result.exitCode && !result.stderr);

		if (passes) {
			stub.withArgs(command, commandArgs).resolves(result);
		} else {
			stub.withArgs(command, commandArgs).rejects(Object.assign(new Error(), result)); // eslint-disable-line unicorn/error-message
		}
	}

	return stub;
};

const _stubExeca = (source, importMeta) => async commands => {
	const execaStub = makeExecaStub(commands);

	return esmock(source, importMeta, {}, {
		execa: {
			execa: async (...args) => execaStub.resolves(execa(...args))(...args),
		},
	});
};

export const _createFixture = (source, importMeta) => test.macro(async (t, commands, assertions) => {
	const stubExeca = _stubExeca(source, importMeta);
	const testedModule = await stubExeca(commands);
	await assertions({t, testedModule});
});
