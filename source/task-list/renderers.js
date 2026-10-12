import {createLogUpdate} from 'log-update';
import exitHook from 'exit-hook';
import isInteractive from 'is-interactive';
import logSymbols from 'log-symbols';
import chalk from 'chalk';
import stripAnsi from 'strip-ansi';
import cliTruncate from 'cli-truncate';

/**
@import {Task, TaskEvent, Renderer, RendererFactory} from './index.js'
*/

const spinnerFrames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
const spinnerInterval = 80;

/**
Get the lines of a task output or error message as plain text. For a line that redraws itself with carriage returns, like a progress bar, only the last version is used.

@param {string} text - The text to split.
@returns {string[]} The lines that are not empty.
*/
const getPlainLines = text => stripAnsi(text)
	.split('\n')
	.map(line => line.split('\r').findLast(part => part.trim() !== '') ?? '')
	.map(line => line.trimEnd())
	.filter(line => line !== '');

// Get the plain lines of the text, each with an arrow in front.
const getArrowLines = text => getPlainLines(text).map(line => `→ ${line}`);

const getErrorMessage = error => error instanceof Error ? error.message : String(error);

const getSymbol = (task, spinnerFrame) => {
	switch (task.state) {
		case 'running': {
			return chalk.yellow(spinnerFrames[spinnerFrame % spinnerFrames.length]);
		}

		case 'completed': {
			return logSymbols.success;
		}

		case 'skipped': {
			return chalk.yellow('↓');
		}

		case 'failed': {
			return task.subtasks.length > 0 ? chalk.yellow('❯') : logSymbols.error;
		}

		default: {
			return ' ';
		}
	}
};

// The line shown below a task.
const getDetail = task => {
	switch (task.state) {
		case 'running':
		case 'skipped': {
			return getPlainLines(task.output ?? '').at(-1);
		}

		case 'failed': {
			// A task with subtasks shows its failed subtask instead.
			return task.subtasks.length > 0 ? undefined : getPlainLines(getErrorMessage(task.error)).at(-1);
		}

		default: {
			return undefined;
		}
	}
};

/**
Render the task list as text.

Subtasks are only shown when their parent task failed. A running or skipped task shows the last line of its output, and a failed task shows the last line of its error.

@param {readonly Task[]} tasks - The tasks to render.
@param {{spinnerFrame?: number; width?: number; level?: number}} [options] - The spinner frame to show, the terminal width, and the nesting level.
@returns {string[]} The rendered lines.
*/
function renderTasks(tasks, {spinnerFrame = 0, width = 80, level = 0} = {}) {
	const indent = '  '.repeat(level);
	const lines = [];

	for (const task of tasks) {
		if (task.state === 'disabled') {
			continue;
		}

		const skippedLabel = task.state === 'skipped' ? chalk.dim(' [skipped]') : '';
		lines.push(`${indent} ${getSymbol(task, spinnerFrame)} ${task.title}${skippedLabel}`);

		const detail = getDetail(task);
		if (detail !== undefined) {
			// Truncate instead of wrapping, so a long line does not make the list jump. Leave the last column free, as some terminals wrap when it is written.
			const line = cliTruncate(`${indent}   → ${detail}`, Math.max(width - 1, 1));
			lines.push(chalk.gray(line));
		}

		if (task.state === 'failed') {
			lines.push(...renderTasks(task.subtasks, {spinnerFrame, width, level: level + 1}));
		}
	}

	return lines;
}

/**
Draws the task list in place and animates the spinners.

@type {RendererFactory}
*/
const defaultRenderer = ({tasks, stream, clearOnSuccess}) => {
	const logUpdate = createLogUpdate(stream);
	let spinnerFrame = 0;
	let timer;

	const render = () => renderTasks(tasks, {spinnerFrame, width: stream.columns}).join('\n');

	const draw = () => {
		logUpdate(render());
	};

	const start = () => {
		draw();
		timer = setInterval(() => {
			spinnerFrame++;
			draw();
		}, spinnerInterval);
	};

	const stop = () => {
		clearInterval(timer);
		timer = undefined;
	};

	// Stop drawing when the process exits, for example on Ctrl+C, so the frame does not draw over what the exit handlers print. It also shows the cursor again.
	const removeExitHook = exitHook(() => {
		stop();
		logUpdate.done();
	});

	start();

	return {
		pause() {
			stop();
			logUpdate.clear();
			// Shows the cursor for a prompt. The next frame hides it again.
			logUpdate.done();
		},
		resume() {
			start();
		},
		done(error) {
			stop();
			removeExitHook();

			if (clearOnSuccess && error === undefined) {
				logUpdate.clear();
			} else {
				// Unlike a drawn frame, this is not cut to the terminal height, so the whole list stays in the scrollback.
				logUpdate.persist(render());
			}

			// Shows the cursor again.
			logUpdate.done();
		},
	};
};

const formatTime = date => date.toTimeString().slice(0, 8);

/**
Format an event as plain lines.

@param {TaskEvent} event - The event to format.
@returns {string[]} The lines to print.
*/
const formatEvent = event => {
	const title = stripAnsi(event.task.title);

	switch (event.type) {
		case 'started': {
			return [`${title} [started]`];
		}

		case 'completed': {
			return [`${title} [completed]`];
		}

		case 'skipped': {
			return [`${title} [skipped]`, ...getArrowLines(event.reason ?? '')];
		}

		case 'failed': {
			// A task with subtasks fails with the error of a subtask, which was already printed.
			const errorLines = event.task.subtasks.length > 0 ? [] : getArrowLines(getErrorMessage(event.error));
			return [`${title} [failed]`, ...errorLines];
		}

		case 'output': {
			return getArrowLines(event.output ?? '');
		}

		default: {
			return [];
		}
	}
};

/**
Prints a line for each event, for logs and terminals that are not interactive.

@type {RendererFactory}
*/
const verboseRenderer = ({events, stream}) => {
	const printing = (async () => {
		for await (const event of events) {
			const time = formatTime(new Date());

			for (const line of formatEvent(event)) {
				stream.write(`[${time}] ${line}\n`);
			}
		}
	})();

	// The error is thrown from `done`. This prevents an unhandled rejection before that.
	printing.catch(() => {});

	return {
		done: () => printing,
	};
};

/**
Shows nothing.

@type {RendererFactory}
*/
const silentRenderer = () => ({});

const renderers = {
	default: defaultRenderer,
	verbose: verboseRenderer,
	silent: silentRenderer,
};

/**
Create the renderer for a run.

@param {'default' | 'verbose' | 'silent' | RendererFactory | undefined} renderer - The name of a renderer, or a custom renderer. When `undefined`, the `default` renderer is used in an interactive terminal and the `verbose` renderer otherwise.
@param {Parameters<RendererFactory>[0]} options - The tasks, the events, the stream, and whether to clear on success.
@returns {Renderer} An object with the optional `pause`, `resume`, and `done` methods.
*/
export function createRenderer(renderer, options) {
	if (typeof renderer === 'function') {
		return renderer(options);
	}

	renderer ??= isInteractive({stream: options.stream}) ? 'default' : 'verbose';

	if (!Object.hasOwn(renderers, renderer)) {
		throw new TypeError(`Unknown renderer: \`${renderer}\``);
	}

	return renderers[renderer](options);
}
