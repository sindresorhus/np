import process from 'node:process';
import test from 'node:test';
import assert from 'node:assert/strict';
import {setImmediate as waitForImmediate} from 'node:timers/promises';
import {execa} from 'execa';
import {TaskList, Task} from '../../source/task-list/index.js';

const silent = {renderer: 'silent'};

// A renderer that records the events and the calls to its methods.
const createRecordingRenderer = () => {
	const events = [];
	const calls = [];

	const renderer = ({events: eventIterable}) => {
		const recording = (async () => {
			for await (const event of eventIterable) {
				events.push(event);
			}
		})();

		return {
			pause() {
				calls.push('pause');
			},
			resume() {
				calls.push('resume');
			},
			async done(error) {
				calls.push(['done', error]);
				await recording;
			},
		};
	};

	return {renderer, events, calls};
};

const describeEvent = event => {
	switch (event.type) {
		case 'skipped': {
			return `skipped ${event.task.title}: ${event.reason}`;
		}

		case 'failed': {
			return `failed ${event.task.title}: ${event.error.message}`;
		}

		case 'output': {
			return `output ${event.task.title}: ${event.output}`;
		}

		default: {
			return `${event.type} ${event.task.title}`;
		}
	}
};

const runAndDescribeEvents = async (tasks, {shouldFail = false} = {}) => {
	const {renderer, events} = createRecordingRenderer();
	const running = tasks.run({renderer});

	await (shouldFail ? assert.rejects(running) : running);

	return events.map(event => describeEvent(event));
};

// Assert that no unhandled rejection happens while `callback` runs and shortly after.
const assertNoUnhandledRejection = async callback => {
	const rejections = [];
	const onRejection = reason => {
		rejections.push(reason);
	};

	process.on('unhandledRejection', onRejection);

	try {
		await callback();
		await waitForImmediate();
		await waitForImmediate();
	} finally {
		process.off('unhandledRejection', onRejection);
	}

	assert.deepEqual(rejections, []);
};

test('validates the definitions', () => {
	assert.throws(() => new TaskList('task'), {name: 'TypeError', message: 'Expected an array of task definitions, got `string`'});
	assert.throws(() => new TaskList([undefined]), {name: 'TypeError', message: 'Expected a task definition object, got `undefined`'});
	assert.throws(() => new TaskList([null]), {name: 'TypeError', message: 'Expected a task definition object, got `null`'});
	assert.throws(() => new TaskList([Symbol('task')]), {name: 'TypeError', message: 'Expected a task definition object, got `symbol`'});
	assert.throws(() => new TaskList([{run() {}}]), {name: 'TypeError', message: 'Expected `title` to be a string, got `undefined`'});
	assert.throws(() => new TaskList([{title: 'A'}]), {name: 'TypeError', message: 'Expected `run` of task “A” to be a function, got `undefined`'});
	assert.throws(() => new TaskList([{title: 'A', run() {}, enabled: 'yes'}]), {name: 'TypeError', message: 'Expected `enabled` of task “A” to be a boolean or a function, got `string`'});
	assert.throws(() => new TaskList([{title: 'A', run() {}, skip: 1}]), {name: 'TypeError', message: 'Expected `skip` of task “A” to be a boolean, a string, or a function, got `number`'});
});

test('exposes the tasks in order as a frozen array', () => {
	const tasks = new TaskList([
		{title: 'A', run() {}},
		{title: 'B', run() {}},
	]);

	assert.deepEqual(tasks.tasks.map(task => task.title), ['A', 'B']);
	assert.ok(tasks.tasks.every(task => task instanceof Task));
	assert.ok(Object.isFrozen(tasks.tasks));
	assert.deepEqual(tasks.tasks.map(task => task.state), ['pending', 'pending']);
});

test('an empty list succeeds', async () => {
	await new TaskList([]).run(silent);
});

test('runs the tasks in order, one at a time', async () => {
	const log = [];
	const createTask = title => ({
		title,
		async run() {
			log.push(`start ${title}`);
			await waitForImmediate();
			log.push(`end ${title}`);
		},
	});

	const result = await new TaskList([createTask('A'), createTask('B'), createTask('C')]).run(silent);

	assert.equal(result, undefined);
	assert.deepEqual(log, ['start A', 'end A', 'start B', 'end B', 'start C', 'end C']);
});

test('concurrent tasks run at the same time', async () => {
	const log = [];
	const {promise: gate, resolve: openGate} = Promise.withResolvers();

	const createTask = title => ({
		title,
		async run() {
			log.push(`start ${title}`);

			if (log.length === 3) {
				openGate();
			}

			await gate;
			log.push(`end ${title}`);
		},
	});

	await new TaskList([createTask('A'), createTask('B'), createTask('C')], {concurrent: true}).run(silent);

	assert.deepEqual(log.slice(0, 3), ['start A', 'start B', 'start C']);
	assert.deepEqual(log.slice(3).toSorted((a, b) => a.localeCompare(b)), ['end A', 'end B', 'end C']);
});

test('passes the task to `run`', async () => {
	let receivedTask;
	const tasks = new TaskList([{
		title: 'A',
		run(task) {
			receivedTask = task;
		},
	}]);

	await tasks.run(silent);

	assert.equal(receivedTask, tasks.tasks[0]);
});

test('task states during and after a run', async () => {
	let statesDuringRun;
	const tasks = new TaskList([
		{
			title: 'A',
			run() {
				statesDuringRun = tasks.tasks.map(task => task.state);
			},
		},
		{title: 'B', run() {}},
		{title: 'C', skip: true, run() {}},
		{title: 'D', enabled: false, run() {}},
	]);

	await tasks.run(silent);

	assert.deepEqual(statesDuringRun, ['running', 'pending', 'pending', 'disabled']);
	assert.deepEqual(tasks.tasks.map(task => task.state), ['completed', 'completed', 'skipped', 'disabled']);
});

test('a synchronous error fails the task and rejects with the same error', async () => {
	const error = new Error('Sync failure');
	const tasks = new TaskList([{
		title: 'A',
		run() {
			throw error;
		},
	}]);

	await assert.rejects(tasks.run(silent), error);
	assert.equal(tasks.tasks[0].state, 'failed');
	assert.equal(tasks.tasks[0].error, error);
});

test('a rejected promise fails the task and rejects with the same error', async () => {
	const error = new Error('Async failure');
	const tasks = new TaskList([{
		title: 'A',
		async run() {
			throw error;
		},
	}]);

	await assert.rejects(tasks.run(silent), error);
	assert.equal(tasks.tasks[0].state, 'failed');
	assert.equal(tasks.tasks[0].error, error);
});

test('a thrown non-error value is passed through', async () => {
	const tasks = new TaskList([{
		title: 'A',
		run() {
			throw 'Failure'; // eslint-disable-line no-throw-literal
		},
	}]);

	await assert.rejects(tasks.run(silent), error => error === 'Failure');
	assert.equal(tasks.tasks[0].error, 'Failure');
});

test('a sequential list stops at the first failure', async () => {
	let hasRunC = false;
	const tasks = new TaskList([
		{title: 'A', run() {}},
		{
			title: 'B',
			run() {
				throw new Error('B failed');
			},
		},
		{
			title: 'C',
			run() {
				hasRunC = true;
			},
		},
	]);

	await assert.rejects(tasks.run(silent), {message: 'B failed'});

	assert.equal(hasRunC, false);
	assert.deepEqual(tasks.tasks.map(task => task.state), ['completed', 'failed', 'pending']);
});

test('a concurrent list rejects at the first failure without waiting for the other tasks', async () => {
	const {promise: slowTaskGate, resolve: finishSlowTask} = Promise.withResolvers();
	const tasks = new TaskList([
		{
			title: 'Slow',
			run: () => slowTaskGate,
		},
		{
			title: 'Fails',
			async run() {
				throw new Error('Failed early');
			},
		},
	], {concurrent: true});

	await assert.rejects(tasks.run(silent), {message: 'Failed early'});
	assert.equal(tasks.tasks[0].state, 'running');

	finishSlowTask();
	await waitForImmediate();
	assert.equal(tasks.tasks[0].state, 'completed');
});

test('a concurrent task that fails after the first failure does not cause an unhandled rejection', async () => {
	await assertNoUnhandledRejection(async () => {
		const {promise: gate, resolve: openGate} = Promise.withResolvers();
		const tasks = new TaskList([
			{
				title: 'Fails first',
				async run() {
					throw new Error('First');
				},
			},
			{
				title: 'Fails later',
				async run() {
					await gate;
					throw new Error('Second');
				},
			},
		], {concurrent: true});

		await assert.rejects(tasks.run(silent), {message: 'First'});

		openGate();
		await waitForImmediate();
		assert.equal(tasks.tasks[1].state, 'failed');
	});
});

test('a concurrent task that keeps running after the run ended can still set its output', async () => {
	const {promise: gate, resolve: openGate} = Promise.withResolvers();
	const {promise: finished, resolve: finish} = Promise.withResolvers();
	const {renderer, events} = createRecordingRenderer();

	const tasks = new TaskList([
		{
			title: 'Fails',
			async run() {
				throw new Error('Failed');
			},
		},
		{
			title: 'Slow',
			async run(task) {
				await gate;
				task.output = 'Late output';
				finish();
			},
		},
	], {concurrent: true});

	await assert.rejects(tasks.run({renderer}), {message: 'Failed'});
	const eventCount = events.length;

	openGate();
	await finished;

	assert.equal(tasks.tasks[1].output, 'Late output');
	assert.equal(events.length, eventCount, 'Events after the run ended should be dropped');
});

test('`enabled` accepts a boolean or a function', async () => {
	const ran = [];
	const createTask = (title, enabled) => ({
		title,
		enabled,
		run() {
			ran.push(title);
		},
	});

	const tasks = new TaskList([
		createTask('Default'),
		createTask('True', true),
		createTask('False', false),
		createTask('Function true', () => true),
		createTask('Function false', () => false),
		createTask('Async true', async () => true),
		createTask('Async false', async () => false),
		createTask('Truthy', () => 'yes'),
		createTask('Falsy', () => 0),
	]);

	await tasks.run(silent);

	assert.deepEqual(ran, ['Default', 'True', 'Function true', 'Async true', 'Truthy']);
	assert.deepEqual(
		tasks.tasks.filter(task => task.state === 'disabled').map(task => task.title),
		['False', 'Function false', 'Async false', 'Falsy'],
	);
});

test('`enabled` is evaluated when the list starts', async () => {
	let isEnabled = false;
	const tasks = new TaskList([
		{
			title: 'A',
			run() {
				isEnabled = true;
			},
		},
		{
			title: 'B',
			enabled: () => isEnabled,
			run() {},
		},
	]);

	await tasks.run(silent);

	assert.equal(tasks.tasks[1].state, 'disabled');
});

test('an `enabled` function that throws rejects the run before any task runs', async () => {
	let hasRun = false;
	const tasks = new TaskList([
		{
			title: 'A',
			run() {
				hasRun = true;
			},
		},
		{
			title: 'B',
			enabled() {
				throw new Error('Cannot decide');
			},
			run() {},
		},
	]);

	await assert.rejects(tasks.run(silent), {message: 'Cannot decide'});
	assert.equal(hasRun, false);
});

test('`skip` accepts a boolean, a string, or a function', async () => {
	const ran = [];
	const createTask = (title, skip) => ({
		title,
		skip,
		run() {
			ran.push(title);
		},
	});

	const tasks = new TaskList([
		createTask('Default'),
		createTask('True', true),
		createTask('False', false),
		createTask('String', 'Not needed'),
		createTask('Empty string', ''),
		createTask('Function reason', () => 'Reason'),
		createTask('Function undefined', () => undefined),
		createTask('Async reason', async () => 'Async reason'),
		createTask('Async false', async () => false),
	]);

	await tasks.run(silent);

	assert.deepEqual(ran, ['Default', 'False', 'Empty string', 'Function undefined', 'Async false']);

	const skipped = tasks.tasks
		.filter(task => task.state === 'skipped')
		.map(task => [task.title, task.output]);

	assert.deepEqual(skipped, [
		['True', undefined],
		['String', 'Not needed'],
		['Function reason', 'Reason'],
		['Async reason', 'Async reason'],
	]);
});

test('`skip` is evaluated when the task starts', async () => {
	let shouldSkip = false;
	const tasks = new TaskList([
		{
			title: 'A',
			run() {
				shouldSkip = true;
			},
		},
		{
			title: 'B',
			skip: () => shouldSkip,
			run() {},
		},
	]);

	await tasks.run(silent);

	assert.equal(tasks.tasks[1].state, 'skipped');
});

test('a `skip` function that throws fails the task', async () => {
	let hasRun = false;
	const tasks = new TaskList([{
		title: 'A',
		skip() {
			throw new Error('Cannot decide');
		},
		run() {
			hasRun = true;
		},
	}]);

	await assert.rejects(tasks.run(silent), {message: 'Cannot decide'});
	assert.equal(hasRun, false);
	assert.equal(tasks.tasks[0].state, 'failed');
});

test('each value of an async generator becomes the output', async () => {
	const outputs = [];
	const tasks = new TaskList([{
		title: 'A',
		async * run(task) {
			yield 'One';
			outputs.push(task.output);
			yield 'Two';
			outputs.push(task.output);
		},
	}]);

	const events = await runAndDescribeEvents(tasks);

	assert.deepEqual(outputs, ['One', 'Two']);
	assert.equal(tasks.tasks[0].output, 'Two');
	assert.deepEqual(events, ['started A', 'output A: One', 'output A: Two', 'completed A']);
});

test('an async generator that throws fails the task and keeps the output so far', async () => {
	const tasks = new TaskList([{
		title: 'A',
		async * run() {
			yield 'Working';
			throw new Error('Generator failed');
		},
	}]);

	await assert.rejects(tasks.run(silent), {message: 'Generator failed'});
	assert.equal(tasks.tasks[0].state, 'failed');
	assert.equal(tasks.tasks[0].output, 'Working');
});

test('a value that is not a string fails the task', async () => {
	let isGeneratorClosed = false;
	const tasks = new TaskList([{
		title: 'A',
		async * run() {
			try {
				yield 1;
			} finally {
				isGeneratorClosed = true;
			}
		},
	}]);

	await assert.rejects(tasks.run(silent), {name: 'TypeError', message: 'Expected `output` to be a string, got `number`'});
	assert.equal(isGeneratorClosed, true);
});

test('a custom async iterable becomes the output', async () => {
	const tasks = new TaskList([{
		title: 'A',
		run: () => ({
			async * [Symbol.asyncIterator]() {
				yield 'From iterable';
			},
		}),
	}]);

	await tasks.run(silent);

	assert.equal(tasks.tasks[0].output, 'From iterable');
});

test('a value that is both an async iterable and a promise is iterated and then awaited', async () => {
	const error = new Error('Failed after the output');
	const result = Object.assign(Promise.reject(error), {
		async * [Symbol.asyncIterator]() {
			yield 'Output';
		},
	});

	// Prevent an unhandled rejection before the task awaits it.
	result.catch(() => {});

	const tasks = new TaskList([{title: 'A', run: () => result}]);

	await assert.rejects(tasks.run(silent), error);
	assert.equal(tasks.tasks[0].output, 'Output');
});

test('an execa subprocess shows its output lines', async () => {
	const tasks = new TaskList([{
		title: 'A',
		run: () => execa('node', ['--eval', 'console.log("first"); console.log("second");']),
	}]);

	const events = await runAndDescribeEvents(tasks);

	assert.deepEqual(events, ['started A', 'output A: first', 'output A: second', 'completed A']);
});

test('a failing execa subprocess fails the task', async () => {
	const tasks = new TaskList([{
		title: 'A',
		run: () => execa('node', ['--eval', 'console.log("before"); process.exit(2);']),
	}]);

	await assert.rejects(tasks.run(silent), {exitCode: 2});
	assert.equal(tasks.tasks[0].state, 'failed');
	assert.equal(tasks.tasks[0].output, 'before');
});

test('an execa subprocess shows the lines of both stdout and stderr', async () => {
	const tasks = new TaskList([{
		title: 'A',
		run: () => execa('node', ['--eval', 'console.log("out"); console.error("error");'], {all: true}).iterable({from: 'all'}),
	}]);

	const events = await runAndDescribeEvents(tasks);

	// The two streams can arrive in any order.
	assert.deepEqual(events.toSorted((a, b) => a.localeCompare(b)), ['completed A', 'output A: error', 'output A: out', 'started A']);
});

test('a failing execa subprocess that shows the lines of both stdout and stderr fails the task', async () => {
	const tasks = new TaskList([{
		title: 'A',
		run: () => execa('node', ['--eval', 'console.error("broken"); process.exit(2);'], {all: true}).iterable({from: 'all'}),
	}]);

	await assert.rejects(tasks.run(silent), {exitCode: 2});
	assert.equal(tasks.tasks[0].state, 'failed');
	assert.equal(tasks.tasks[0].output, 'broken');
});

test('a returned task list runs as subtasks', async () => {
	const log = [];
	const subtasks = new TaskList([
		{
			title: 'Sub A',
			run() {
				log.push('Sub A');
			},
		},
		{
			title: 'Sub B',
			run() {
				log.push('Sub B');
			},
		},
	]);

	const tasks = new TaskList([
		{title: 'Parent', run: () => subtasks},
		{
			title: 'After',
			run() {
				log.push('After');
			},
		},
	]);

	const events = await runAndDescribeEvents(tasks);

	assert.deepEqual(log, ['Sub A', 'Sub B', 'After']);
	assert.equal(tasks.tasks[0].state, 'completed');
	assert.equal(tasks.tasks[0].subtasks, subtasks.tasks);
	assert.deepEqual(events, [
		'started Parent',
		'started Sub A',
		'completed Sub A',
		'started Sub B',
		'completed Sub B',
		'completed Parent',
		'started After',
		'completed After',
	]);
});

test('a promise for a task list runs as subtasks', async () => {
	let hasRun = false;
	const tasks = new TaskList([{
		title: 'Parent',
		async run() {
			await waitForImmediate();

			return new TaskList([{
				title: 'Sub',
				run() {
					hasRun = true;
				},
			}]);
		},
	}]);

	await tasks.run(silent);

	assert.equal(hasRun, true);
	assert.deepEqual(tasks.tasks[0].subtasks.map(task => task.state), ['completed']);
});

test('a task without subtasks has an empty array', async () => {
	const tasks = new TaskList([{title: 'A', run() {}}]);
	await tasks.run(silent);
	assert.deepEqual(tasks.tasks[0].subtasks, []);
});

test('a failing subtask fails the parent with the same error', async () => {
	const error = new Error('Sub failed');
	const tasks = new TaskList([
		{
			title: 'Parent',
			run: () => new TaskList([
				{
					title: 'Sub',
					run() {
						throw error;
					},
				},
				{title: 'Sub after', run() {}},
			]),
		},
		{title: 'After', run() {}},
	]);

	await assert.rejects(tasks.run(silent), error);

	assert.equal(tasks.tasks[0].state, 'failed');
	assert.equal(tasks.tasks[0].error, error);
	assert.deepEqual(tasks.tasks[0].subtasks.map(task => task.state), ['failed', 'pending']);
	assert.equal(tasks.tasks[1].state, 'pending');
});

test('nested subtasks can be concurrent, disabled, and skipped', async () => {
	const tasks = new TaskList([{
		title: 'Parent',
		run: () => new TaskList([
			{title: 'Disabled', enabled: false, run() {}},
			{title: 'Skipped', skip: 'Because', run() {}},
			{
				title: 'Nested',
				run: () => new TaskList([{title: 'Deep', run() {}}]),
			},
		], {concurrent: true}),
	}]);

	await tasks.run(silent);

	const [parent] = tasks.tasks;
	assert.deepEqual(parent.subtasks.map(task => task.state), ['disabled', 'skipped', 'completed']);
	assert.deepEqual(parent.subtasks[2].subtasks.map(task => task.state), ['completed']);
});

test('a task list can only run once', async () => {
	const tasks = new TaskList([{title: 'A', run() {}}]);
	await tasks.run(silent);
	await assert.rejects(tasks.run(silent), {message: 'A task list can only run once'});
});

test('a task list that already ran fails as subtasks', async () => {
	const subtasks = new TaskList([{title: 'Sub', run() {}}]);
	await subtasks.run(silent);

	const tasks = new TaskList([{title: 'Parent', run: () => subtasks}]);

	await assert.rejects(tasks.run(silent), {message: 'A task list can only run once'});
	assert.equal(tasks.tasks[0].state, 'failed');
	// The parent failed with its own error, not through a subtask, so renderers show the error on the parent.
	assert.deepEqual(tasks.tasks[0].subtasks, []);
});

test('a subtask list whose `enabled` throws fails the parent with that error', async () => {
	const tasks = new TaskList([{
		title: 'Parent',
		run: () => new TaskList([{
			title: 'Sub',
			enabled() {
				throw new Error('Cannot decide');
			},
			run() {},
		}]),
	}]);

	await assert.rejects(tasks.run(silent), {message: 'Cannot decide'});
	assert.equal(tasks.tasks[0].state, 'failed');
	assert.deepEqual(tasks.tasks[0].subtasks, []);
});

test('the title is read-only', async () => {
	const tasks = new TaskList([{
		title: 'A',
		run(task) {
			task.title = 'B';
		},
	}]);

	await assert.rejects(tasks.run(silent), {name: 'TypeError'});
	assert.equal(tasks.tasks[0].title, 'A');
});

test('setting the output emits an event, and `undefined` clears it', async () => {
	const tasks = new TaskList([{
		title: 'A',
		run(task) {
			task.output = 'Hello';
			task.output = undefined;
		},
	}]);

	const events = await runAndDescribeEvents(tasks);

	assert.equal(tasks.tasks[0].output, undefined);
	assert.deepEqual(events, ['started A', 'output A: Hello', 'output A: undefined', 'completed A']);
});

test('the output must be a string or `undefined`', async () => {
	const tasks = new TaskList([{
		title: 'A',
		run(task) {
			task.output = 42;
		},
	}]);

	await assert.rejects(tasks.run(silent), {name: 'TypeError', message: 'Expected `output` to be a string, got `number`'});
});

test('events for skipped and failed tasks', async () => {
	const tasks = new TaskList([
		{title: 'Skipped with reason', skip: 'The reason', run() {}},
		{title: 'Skipped', skip: true, run() {}},
		{
			title: 'Failed',
			run() {
				throw new Error('The error');
			},
		},
	]);

	const events = await runAndDescribeEvents(tasks, {shouldFail: true});

	assert.deepEqual(events, [
		'started Skipped with reason',
		'skipped Skipped with reason: The reason',
		'started Skipped',
		'skipped Skipped: undefined',
		'started Failed',
		'failed Failed: The error',
	]);
});

test('events are frozen snapshots', async () => {
	const {renderer, events} = createRecordingRenderer();
	const tasks = new TaskList([{
		title: 'A',
		run(task) {
			task.output = 'First';
			task.output = 'Second';
		},
	}]);

	await tasks.run({renderer});

	const outputEvents = events.filter(event => event.type === 'output');
	assert.deepEqual(outputEvents.map(event => event.output), ['First', 'Second']);
	assert.ok(events.every(event => Object.isFrozen(event)));
	assert.ok(events.every(event => event.task === tasks.tasks[0]));
});

test('the event iteration ends when the run ends', async () => {
	let hasIterationEnded = false;
	const renderer = ({events}) => {
		const iterating = (async () => {
			for await (const _event of events) {
				// Read all events.
			}

			hasIterationEnded = true;
		})();

		return {
			done: () => iterating,
		};
	};

	await new TaskList([{title: 'A', run() {}}]).run({renderer});

	assert.equal(hasIterationEnded, true);
});

test('the renderer gets the tasks, the stream, and the options', async () => {
	let options;
	const stream = {isTTY: false, write() {}};
	const tasks = new TaskList([{title: 'A', run() {}}]);

	await tasks.run({
		stream,
		clearOnSuccess: true,
		renderer(rendererOptions) {
			options = rendererOptions;
			return {};
		},
	});

	assert.equal(options.tasks, tasks.tasks);
	assert.equal(options.stream, stream);
	assert.equal(options.clearOnSuccess, true);
	assert.equal(typeof options.events[Symbol.asyncIterator], 'function');
});

test('the renderer is created after `enabled` is evaluated', async () => {
	let statesWhenCreated;
	const tasks = new TaskList([
		{title: 'A', run() {}},
		{title: 'B', enabled: false, run() {}},
	]);

	await tasks.run({
		renderer(options) {
			statesWhenCreated = options.tasks.map(task => task.state);
			return {};
		},
	});

	assert.deepEqual(statesWhenCreated, ['pending', 'disabled']);
});

test('`done` of the renderer gets `undefined` on success and the error on failure', async () => {
	const success = createRecordingRenderer();
	await new TaskList([{title: 'A', run() {}}]).run({renderer: success.renderer});
	assert.deepEqual(success.calls, [['done', undefined]]);

	const error = new Error('Failed');
	const failure = createRecordingRenderer();
	await assert.rejects(new TaskList([{
		title: 'A',
		run() {
			throw error;
		},
	}]).run({renderer: failure.renderer}), error);
	assert.deepEqual(failure.calls, [['done', error]]);
});

test('an error from `done` of the renderer rejects the run when the tasks succeeded', async () => {
	const renderer = () => ({
		done() {
			throw new Error('Renderer failed');
		},
	});

	await assert.rejects(new TaskList([{title: 'A', run() {}}]).run({renderer}), {message: 'Renderer failed'});
});

test('the task error wins over an error from `done` of the renderer', async () => {
	const renderer = () => ({
		done() {
			throw new Error('Renderer failed');
		},
	});

	const tasks = new TaskList([{
		title: 'A',
		run() {
			throw new Error('Task failed');
		},
	}]);

	await assert.rejects(tasks.run({renderer}), {message: 'Task failed'});
});

test('an unknown renderer rejects before any task runs', async () => {
	let hasRun = false;
	const tasks = new TaskList([{
		title: 'A',
		run() {
			hasRun = true;
		},
	}]);

	await assert.rejects(tasks.run({renderer: 'fancy'}), {name: 'TypeError', message: 'Unknown renderer: `fancy`'});
	assert.equal(hasRun, false);
});

test('`withTerminal` pauses the renderer while the callback runs', async () => {
	const {renderer, calls} = createRecordingRenderer();
	let callsInCallback;

	const tasks = new TaskList([{
		title: 'A',
		async run(task) {
			const result = await task.withTerminal(async () => {
				callsInCallback = [...calls];
				return 'Answer';
			});

			assert.equal(result, 'Answer');
		},
	}]);

	await tasks.run({renderer});

	assert.deepEqual(callsInCallback, ['pause']);
	assert.deepEqual(calls, ['pause', 'resume', ['done', undefined]]);
});

test('`withTerminal` resumes the renderer when the callback throws', async () => {
	const {renderer, calls} = createRecordingRenderer();
	const error = new Error('Prompt failed');

	const tasks = new TaskList([{
		async run(task) {
			await task.withTerminal(() => {
				throw error;
			});
		},
		title: 'A',
	}]);

	await assert.rejects(tasks.run({renderer}), error);
	assert.deepEqual(calls, ['pause', 'resume', ['done', error]]);
});

test('`withTerminal` calls run one at a time', async () => {
	const log = [];
	const {renderer, calls} = createRecordingRenderer();

	const createTask = title => ({
		title,
		async run(task) {
			await task.withTerminal(async () => {
				log.push(`start ${title}`);
				await waitForImmediate();
				log.push(`end ${title}`);
			});
		},
	});

	await new TaskList([createTask('A'), createTask('B')], {concurrent: true}).run({renderer});

	assert.deepEqual(log, ['start A', 'end A', 'start B', 'end B']);
	assert.deepEqual(calls, ['pause', 'resume', 'pause', 'resume', ['done', undefined]]);
});

test('`withTerminal` works with a renderer without `pause` and `resume`, which never reads the events', async () => {
	const tasks = new TaskList([{
		title: 'A',
		run: task => task.withTerminal(() => 'Done'),
	}]);

	await tasks.run({renderer: () => ({})});
	assert.equal(tasks.tasks[0].state, 'completed');
});

test('`withTerminal` throws when the task has not started', async () => {
	const tasks = new TaskList([{title: 'A', run() {}}]);

	await assert.rejects(tasks.tasks[0].withTerminal(() => {}), {message: 'Task “A” has not started'});
});

test('the run ends after a task that uses the terminal is done', async () => {
	const {promise: gate, resolve: openGate} = Promise.withResolvers();
	const {renderer, calls} = createRecordingRenderer();
	let isRunSettled = false;

	const tasks = new TaskList([
		{
			title: 'Prompt',
			run: task => task.withTerminal(() => gate),
		},
		{
			title: 'Fails',
			async run() {
				await waitForImmediate();
				throw new Error('Failed');
			},
		},
	], {concurrent: true});

	const running = tasks.run({renderer});
	running.catch(() => {}).finally(() => {
		isRunSettled = true;
	});

	await waitForImmediate();
	await waitForImmediate();
	assert.equal(isRunSettled, false);
	assert.deepEqual(calls, ['pause']);

	openGate();
	await assert.rejects(running, {message: 'Failed'});
	assert.deepEqual(calls.slice(0, 2), ['pause', 'resume']);
	assert.equal(calls[2][0], 'done');
	assert.equal(calls[2][1].message, 'Failed');
});

test('`withTerminal` after the run ended runs the callback without pausing', async () => {
	const {promise: gate, resolve: openGate} = Promise.withResolvers();
	const {promise: finished, resolve: finish} = Promise.withResolvers();
	const {renderer, calls} = createRecordingRenderer();

	const tasks = new TaskList([
		{
			title: 'Fails',
			async run() {
				throw new Error('Failed');
			},
		},
		{
			title: 'Late',
			async run(task) {
				await gate;
				finish(await task.withTerminal(() => 'Late answer'));
			},
		},
	], {concurrent: true});

	await assert.rejects(tasks.run({renderer}), {message: 'Failed'});

	openGate();
	assert.equal(await finished, 'Late answer');
	assert.equal(calls.filter(call => call === 'pause').length, 0);
});

test('`withTerminal` inside subtasks pauses the renderer of the run', async () => {
	const {renderer, calls} = createRecordingRenderer();

	const tasks = new TaskList([{
		title: 'Parent',
		run: () => new TaskList([{
			title: 'Sub',
			run: task => task.withTerminal(() => {}),
		}]),
	}]);

	await tasks.run({renderer});

	assert.deepEqual(calls, ['pause', 'resume', ['done', undefined]]);
});
