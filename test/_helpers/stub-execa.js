import {test} from 'node:test';
import esmock from 'esmock';
import sinon from 'sinon';
import {execa} from 'execa';

// Default stubs for common commands that should pass by default
const defaultCommands = [
	{command: 'npm --version', stdout: '10.0.0'},
	{command: 'npm ping', stdout: ''},
	{command: 'npm view --json test engines', stdout: ''},
	{command: 'npm view --json test@1.0.0 engines', stdout: ''},
	{command: 'npm view --json test@0.1.0 engines', stdout: ''},
	{command: 'npm view --json test@0.0.0 engines', stdout: ''},
	{command: 'git version', stdout: 'git version 2.40.0'},
	{command: 'git ls-remote origin HEAD', stdout: 'abc123\tHEAD'},
	{command: 'git fetch', stdout: ''},
	{command: 'git config --get tag.gpgSign', stdout: ''},
];

/**
Stubs `execa` to return a specific result when called with the given commands.

A command passes if its exit code is 0, or if there's no exit code and no stderr.

Resolves or throws the given result.

@param {import('execa').ExecaReturnValue[]} commands - Command stubs with expected args and result values.
*/
const makeExecaStub = commands => {
	const normalizedCommands = [...defaultCommands, ...commands].map(result => {
		const [command, ...commandArguments] = result.command.split(' ');
		return {
			...result,
			command,
			commandArguments,
		};
	});

	return sinon.stub().callsFake((command, commandArguments = [], options) => {
		for (let index = normalizedCommands.length - 1; index >= 0; index--) {
			const result = normalizedCommands[index];

			if ((result.command !== command) || !areArgumentsEqual(result.commandArguments, commandArguments) || !matchesOptions(result.options, options)) {
				continue;
			}

			const isPasses = result.exitCode === 0 || (!result.exitCode && !result.stderr);

			if (isPasses) {
				return Promise.resolve(result);
			}

			return Promise.reject(Object.assign(new Error(), result)); // eslint-disable-line unicorn/error-message
		}
	});
};

const areArgumentsEqual = (left, right) => left.length === right.length && left.every((value, index) => value === right[index]);

const matchesOptions = (expectedOptions, actualOptions) => {
	if (!expectedOptions) {
		return true;
	}

	return actualOptions ? Object.entries(expectedOptions).every(([key, value]) => Object.is(actualOptions[key], value)) : false;
};

const stubExeca = commands => {
	const execaStub = makeExecaStub(commands);

	return {
		execa: {
			async execa(...arguments_) {
				// Only call real execa if stub doesn't have a match
				const result = execaStub(...arguments_);
				return result === undefined ? execa(...arguments_) : result;
			},
		},
	};
};

export const _createFixture = (source, importMeta) => (title, commands, assertions) => test(title, async t => {
	const testedModule = await esmock(source, importMeta, {}, stubExeca(commands));
	await assertions({t, testedModule});
});
