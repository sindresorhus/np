import esmock from 'esmock';
import sinon from 'sinon';
import {execa} from 'execa';
import {SilentRenderer} from './fixtures/listr-renderer.js';

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

export const _stubExeca = (source, importMeta) => async commands => {
	const execaStub = makeExecaStub(commands);

	return esmock(source, importMeta, {}, {
		execa: {
			execa: async (...args) => execaStub.resolves(execa(...args))(...args),
		},
	});
};

export const run = async listr => {
	listr.setRenderer(SilentRenderer);
	await listr.run();
};

export const assertTaskFailed = (t, taskTitle) => {
	const task = SilentRenderer.tasks.find(task => task.title === taskTitle);
	t.true(task.hasFailed(), `'${taskTitle}' did not fail!`);
};

export const assertTaskDisabled = (t, taskTitle) => {
	const task = SilentRenderer.tasks.find(task => task.title === taskTitle);
	t.true(!task.isEnabled(), `'${taskTitle}' was enabled!`);
};

export const assertTaskDoesntExist = (t, taskTitle) => {
	t.true(SilentRenderer.tasks.every(task => task.title !== taskTitle), `'${taskTitle}' exists!`);
};

export const runIfExists = async (func, ...args) => {
	if (typeof func === 'function') {
		await func(...args);
	}
};
