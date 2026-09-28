import assert from 'node:assert/strict';
import {SilentRenderer} from './listr-renderer.js';

export const run = async listr => {
	listr.setRenderer(SilentRenderer);
	await listr.run();
};

export const assertTaskFailed = taskTitle => {
	const task = SilentRenderer.tasks.find(task => task.title === taskTitle);
	assert.ok(task.hasFailed(), `Task '${taskTitle}' did not fail!`);
};

export const assertTaskDisabled = taskTitle => {
	const task = SilentRenderer.tasks.find(task => task.title === taskTitle);
	assert.ok(!task.isEnabled(), `Task '${taskTitle}' was enabled!`);
};

export const assertTaskDoesntExist = taskTitle => {
	assert.ok(SilentRenderer.tasks.every(task => task.title !== taskTitle), `Task '${taskTitle}' exists!`);
};

export const assertTaskSkipped = taskTitle => {
	const task = SilentRenderer.tasks.find(task => task.title === taskTitle);
	assert.ok(task.isSkipped(), `Task '${taskTitle}' was not skipped!`);
};
