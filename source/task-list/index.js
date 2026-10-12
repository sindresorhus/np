import process from 'node:process';
import {on} from 'node:events';
import {createRenderer} from './renderers.js';

/**
@typedef {'pending' | 'disabled' | 'running' | 'completed' | 'skipped' | 'failed'} TaskState
*/

/**
What a task's `run` function can return:
- Nothing, or a promise.
- An async iterable, like an async generator. Each value is shown as the task's output. An execa subprocess is iterated and then awaited.
- A `TaskList`, or a promise for one. It runs as the subtasks of the task.

@typedef {void | TaskList | AsyncIterable<string> | PromiseLike<void | TaskList>} TaskResult
*/

/**
@typedef {object} TaskDefinition
@property {string} title - The title shown for the task.
@property {(task: Task) => TaskResult} run - Runs the task.
@property {boolean | (() => boolean | PromiseLike<boolean>)} [enabled=true] - Whether the task is part of the list. It is evaluated when the list starts. A disabled task is not shown.
@property {boolean | string | (() => boolean | string | undefined | PromiseLike<boolean | string | undefined>)} [skip] - Whether to skip the task. It is evaluated when the task starts. Return a string to show it as the reason.
*/

/**
An event of a task list run. The values of an event are from the time it happened, but `task` is the live task.

@typedef {{type: 'started', task: Task}
	| {type: 'completed', task: Task}
	| {type: 'skipped', task: Task, reason: string | undefined}
	| {type: 'failed', task: Task, error: unknown}
	| {type: 'output', task: Task, output: string | undefined}} TaskEvent
*/

/**
@typedef {object} Renderer
@property {() => void} [pause] - Stop drawing and clear the drawn output, so a task can use the terminal.
@property {() => void} [resume] - Start drawing again.
@property {(error: unknown) => void | PromiseLike<void>} [done] - Draw the final state. `error` is `undefined` when all tasks succeeded.
*/

/**
@typedef {(options: {tasks: readonly Task[]; events: AsyncIterable<TaskEvent>; stream: NodeJS.WriteStream; clearOnSuccess: boolean}) => Renderer} RendererFactory
*/

// Module-private methods shared between `Task` and `TaskList`.
const prepare = Symbol('prepare');
const execute = Symbol('execute');

const isAsyncIterable = value => typeof value?.[Symbol.asyncIterator] === 'function';

const resolveOption = async option => typeof option === 'function' ? option() : option;

/**
The state shared by all tasks and subtasks of one run.
*/
class Runner {
	#events = new EventTarget();
	#terminalQueue = Promise.resolve();
	#isEnded = false;
	/**
	The renderer of the run. It is set before any task runs.

	@type {Renderer}
	*/
	renderer = {};

	/**
	The events of the run, from the moment iteration starts. Start iterating before the run ends, for example when the renderer is created, as an iteration started later never ends.

	@returns {AsyncIterable<TaskEvent>} An iterable that ends when the run ends.
	*/
	get events() {
		const target = this.#events;

		return {
			[Symbol.asyncIterator]() {
				// Subscribe now, not when the generator first runs, so no events are missed.
				const iterator = on(target, 'event', {close: ['end']});

				return (async function * () {
					for await (const [{detail}] of iterator) {
						yield detail;
					}
				})();
			},
		};
	}

	/**
	Send an event to the event iterators. Events after the run ended are dropped, as the iterators stopped.

	@param {TaskEvent} event - A snapshot of what happened.
	*/
	emit(event) {
		this.#events.dispatchEvent(new CustomEvent('event', {detail: Object.freeze(event)}));
	}

	/**
	Run `callback` while the renderer is paused. Calls run one at a time.

	@template T
	@param {() => T | PromiseLike<T>} callback - A function that uses the terminal.
	@returns {Promise<T>} What `callback` returns.
	*/
	async withTerminal(callback) {
		const previous = this.#terminalQueue;
		const {promise, resolve} = Promise.withResolvers();
		this.#terminalQueue = promise;

		try {
			await previous;

			if (this.#isEnded) {
				return await callback();
			}

			this.renderer.pause?.();

			try {
				return await callback();
			} finally {
				// The run cannot end here, as `end` waits for this call.
				this.renderer.resume?.();
			}
		} finally {
			resolve();
		}
	}

	/**
	End the run once no task uses the terminal, and stop the event iterators.
	*/
	async end() {
		await this.#terminalQueue;
		this.#isEnded = true;
		this.#events.dispatchEvent(new Event('end'));
	}
}

export class Task {
	/** @type {TaskDefinition} */
	#definition;
	#output;
	/** @type {TaskState} */
	#state = 'pending';
	#error;
	/** @type {TaskList | undefined} */
	#subtasks;
	/** @type {Runner | undefined} */
	#runner;

	/**
	Create a task from its definition.

	@param {TaskDefinition} definition - The title, the `run` function, and the options of the task.
	*/
	constructor(definition) {
		if (typeof definition !== 'object' || definition === null) {
			throw new TypeError(`Expected a task definition object, got \`${definition === null ? 'null' : typeof definition}\``);
		}

		const {title, run, enabled, skip} = definition;

		if (typeof title !== 'string') {
			throw new TypeError(`Expected \`title\` to be a string, got \`${typeof title}\``);
		}

		if (typeof run !== 'function') {
			throw new TypeError(`Expected \`run\` of task “${title}” to be a function, got \`${typeof run}\``);
		}

		if (!['undefined', 'boolean', 'function'].includes(typeof enabled)) {
			throw new TypeError(`Expected \`enabled\` of task “${title}” to be a boolean or a function, got \`${typeof enabled}\``);
		}

		if (!['undefined', 'boolean', 'string', 'function'].includes(typeof skip)) {
			throw new TypeError(`Expected \`skip\` of task “${title}” to be a boolean, a string, or a function, got \`${typeof skip}\``);
		}

		this.#definition = definition;
	}

	async #run() {
		let result = this.#definition.run(this);

		if (isAsyncIterable(result)) {
			for await (const output of result) {
				this.output = output;
			}
		}

		// An execa subprocess is both an async iterable and a promise. Awaiting it after the iteration surfaces its error.
		result = await result;

		if (result instanceof TaskList) {
			await result[prepare]();
			// Set after preparing, so a list that cannot start does not count as the subtasks that failed.
			this.#subtasks = result;
			await result[execute](this.#runner);
		}
	}

	get title() {
		return this.#definition.title;
	}

	/**
	The latest output of the task, or the reason it was skipped.

	@returns {string | undefined} The last value set or yielded, or `undefined`.
	*/
	get output() {
		return this.#output;
	}

	set output(output) {
		if (output !== undefined && typeof output !== 'string') {
			throw new TypeError(`Expected \`output\` to be a string, got \`${typeof output}\``);
		}

		this.#output = output;
		this.#runner?.emit({type: 'output', task: this, output});
	}

	/**
	Where the task is in its lifecycle.

	@returns {TaskState} One of `pending`, `disabled`, `running`, `completed`, `skipped`, or `failed`.
	*/
	get state() {
		return this.#state;
	}

	/**
	The error that made the task fail.

	@returns {unknown} The thrown value, or `undefined` when the task did not fail.
	*/
	get error() {
		return this.#error;
	}

	/**
	The tasks of the task list that `run` returned.

	@returns {readonly Task[]} An empty array when `run` did not return a task list.
	*/
	get subtasks() {
		return this.#subtasks?.tasks ?? [];
	}

	/**
	Run `callback` while the task list is not drawn, so the callback can use the terminal, for example to show a prompt or to print lines that must stay. Calls from different tasks run one at a time.

	Do not call `withTerminal` inside a `withTerminal` callback, as the inner call waits for the outer call to end.

	@template T
	@param {() => T | PromiseLike<T>} callback - A function that uses the terminal.
	@returns {Promise<T>} What `callback` returns.
	*/
	async withTerminal(callback) {
		if (!this.#runner) {
			throw new Error(`Task “${this.title}” has not started`);
		}

		return this.#runner.withTerminal(callback);
	}

	async [prepare]() {
		if (!await resolveOption(this.#definition.enabled ?? true)) {
			this.#state = 'disabled';
		}
	}

	async [execute](runner) {
		this.#runner = runner;
		this.#state = 'running';
		runner.emit({type: 'started', task: this});

		try {
			const skip = await resolveOption(this.#definition.skip);

			if (skip) {
				const reason = typeof skip === 'string' ? skip : undefined;
				this.#output = reason;
				this.#state = 'skipped';
				runner.emit({type: 'skipped', task: this, reason});
				return;
			}

			await this.#run();
		} catch (error) {
			this.#error = error;
			this.#state = 'failed';
			runner.emit({type: 'failed', task: this, error});
			throw error;
		}

		this.#state = 'completed';
		runner.emit({type: 'completed', task: this});
	}
}

export class TaskList {
	/** @type {readonly Task[]} */
	#tasks;
	#isConcurrent;
	#isStarted = false;

	/**
	Create a task list. Tasks run in order, or all at once when `concurrent` is `true`.

	@param {readonly TaskDefinition[]} definitions - The definitions of the tasks, in order.
	@param {{concurrent?: boolean}} [options] - Whether the tasks run at the same time.
	*/
	constructor(definitions, {concurrent = false} = {}) {
		if (!Array.isArray(definitions)) {
			throw new TypeError(`Expected an array of task definitions, got \`${typeof definitions}\``);
		}

		this.#tasks = Object.freeze(definitions.map(definition => new Task(definition)));
		this.#isConcurrent = concurrent;
	}

	/**
	The tasks of the list, including disabled ones.

	@returns {readonly Task[]} A frozen array, in the order of the definitions.
	*/
	get tasks() {
		return this.#tasks;
	}

	/**
	Run the tasks and show their progress. It rejects with the error of the first task that fails.

	A sequential list stops at the first failure. A concurrent list rejects at the first failure without waiting for the other tasks.

	A list can only run once.

	@param {object} [options] - The renderer and where it renders to.
	@param {'default' | 'verbose' | 'silent' | RendererFactory} [options.renderer] - How to show the progress. By default, the `default` renderer is used in an interactive terminal and the `verbose` renderer otherwise.
	@param {NodeJS.WriteStream} [options.stream=process.stdout] - The stream to render to.
	@param {boolean} [options.clearOnSuccess=false] - Clear the rendered task list when all tasks succeed.
	*/
	async run({renderer, stream = process.stdout, clearOnSuccess = false} = {}) {
		await this[prepare]();

		const runner = new Runner();
		runner.renderer = createRenderer(renderer, {
			tasks: this.#tasks,
			events: runner.events,
			stream,
			clearOnSuccess,
		});

		let hasFailed = false;
		let runError;

		try {
			await this[execute](runner);
		} catch (error) {
			hasFailed = true;
			runError = error;
		}

		await runner.end();

		try {
			await runner.renderer.done?.(runError);
		} catch (error) {
			if (!hasFailed) {
				hasFailed = true;
				runError = error;
			}
		}

		if (hasFailed) {
			throw runError;
		}
	}

	async [prepare]() {
		if (this.#isStarted) {
			throw new Error('A task list can only run once');
		}

		this.#isStarted = true;

		for (const task of this.#tasks) {
			// eslint-disable-next-line no-await-in-loop
			await task[prepare]();
		}
	}

	async [execute](runner) {
		const tasks = this.#tasks.filter(task => task.state !== 'disabled');

		if (!this.#isConcurrent) {
			for (const task of tasks) {
				// eslint-disable-next-line no-await-in-loop
				await task[execute](runner);
			}

			return;
		}

		// Fail at the first error. `Promise.all` also handles the errors of tasks that fail after it, so they are not unhandled rejections.
		await Promise.all(tasks.map(task => task[execute](runner)));
	}
}
