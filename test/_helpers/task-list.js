import assert from 'node:assert/strict';

/**
Run a task list without showing it.

@param {import('../../source/task-list/index.js').TaskList} tasks - The task list to run.
*/
export const run = tasks => tasks.run({renderer: 'silent'});

const getTask = (tasks, taskTitle) => tasks.tasks.find(task => task.title === taskTitle);

export const assertTaskFailed = (tasks, taskTitle) => {
	assert.equal(getTask(tasks, taskTitle)?.state, 'failed', `Task '${taskTitle}' did not fail!`);
};

export const assertTaskDisabled = (tasks, taskTitle) => {
	assert.equal(getTask(tasks, taskTitle)?.state, 'disabled', `Task '${taskTitle}' was enabled!`);
};

export const assertTaskDoesntExist = (tasks, taskTitle) => {
	assert.equal(getTask(tasks, taskTitle), undefined, `Task '${taskTitle}' exists!`);
};

export const assertTaskSkipped = (tasks, taskTitle) => {
	assert.equal(getTask(tasks, taskTitle)?.state, 'skipped', `Task '${taskTitle}' was not skipped!`);
};
