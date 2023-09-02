import {SilentRenderer} from './listr-renderer.js';

export const run = async listr => {
	listr.setRenderer(SilentRenderer);
	await listr.run();
};

export const assertTaskFailed = (t, taskTitle) => {
	const task = SilentRenderer.tasks.find(task => task.title === taskTitle);
	t.true(task.hasFailed(), `Task '${taskTitle}' did not fail!`);
};

export const assertTaskDisabled = (t, taskTitle) => {
	const task = SilentRenderer.tasks.find(task => task.title === taskTitle);
	t.true(!task.isEnabled(), `Task '${taskTitle}' was enabled!`);
};

export const assertTaskDoesntExist = (t, taskTitle) => {
	t.true(SilentRenderer.tasks.every(task => task.title !== taskTitle), `Task '${taskTitle}' exists!`);
};
