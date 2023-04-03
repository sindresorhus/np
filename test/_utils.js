import esmock from 'esmock';
import {execa} from 'execa';
import {SilentRenderer} from './fixtures/listr-renderer.js';

export const _stubExeca = source => async (t, commands) => esmock(source, {}, {
	execa: {
		async execa(...args) {
			const results = await Promise.all(commands.map(async result => {
				const argsMatch = await t.try(tt => {
					const [command, ...commandArgs] = result.command.split(' ');
					tt.deepEqual(args, [command, commandArgs]);
				});

				if (argsMatch.passed) {
					argsMatch.discard();

					if (!result.exitCode || result.exitCode === 0) {
						return result;
					}

					throw result;
				}

				argsMatch.discard();
			}));

			const result = results.filter(Boolean).at(0);
			return result ?? execa(...args);
		},
	},
});

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
