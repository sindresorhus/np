/* eslint-disable ava/no-ignored-test-files */
import test from 'ava';
import esmock from 'esmock';
import sinon from 'sinon';
import {execa} from 'execa';

/**
Stubs `execa` to return a specific result when called with the given commands.

A command passes if its exit code is 0, or if there's no exit code and no stderr.

Resolves or throws the given result.

@param {import('execa').ExecaReturnValue[]} commands
*/
const makeExecaStub = commands => {
	const stub = sinon.stub();

	for (const result of commands) {
		const [command, ...commandArgs] = result.command.split(' ');

		const passes = result.exitCode === 0 || (!result.exitCode && !result.stderr);

		if (passes) {
			stub.withArgs(command, commandArgs).resolves(result);
		} else {
			stub.withArgs(command, commandArgs).rejects(Object.assign(new Error(), result)); // eslint-disable-line unicorn/error-message
		}
	}

	return stub;
};

const stubExeca = commands => {
	const execaStub = makeExecaStub(commands);

	return {
		execa: {
			async execa(...args) {
				execaStub.resolves(execa(...args));
				return execaStub(...args);
			},
		},
	};
};

export const _createFixture = (source, importMeta) => test.macro(async (t, commands, assertions) => {
	const testedModule = await esmock(source, importMeta, {}, stubExeca(commands));
	await assertions({t, testedModule});
});
