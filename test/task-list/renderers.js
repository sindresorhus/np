import process from 'node:process';
import test from 'node:test';
import assert from 'node:assert/strict';
import {setImmediate as waitForImmediate} from 'node:timers/promises';
import stripAnsi from 'strip-ansi';
import esmock from 'esmock';
import logSymbols from 'log-symbols';
import {TaskList} from '../../source/task-list/index.js';
import {createRenderer} from '../../source/task-list/renderers.js';

const successSymbol = stripAnsi(logSymbols.success);
const errorSymbol = stripAnsi(logSymbols.error);

const createTask = ({title = 'Task', state = 'pending', output, error, subtasks = []} = {}) => ({
	title,
	state,
	output,
	error,
	subtasks,
});

// A fake terminal stream. It applies the escape sequences that `log-update` writes, so tests can check what is visible.
const createTerminal = ({columns = 80, rows = 24, isTTY = true} = {}) => {
	const lines = [''];
	let row = 0;
	let column = 0;
	let writeCount = 0;
	let written = '';

	const applyEscape = (parameters, command) => {
		const count = Number(parameters) || 1;

		switch (command) {
			case 'A': {
				row = Math.max(0, row - count);
				break;
			}

			case 'B': {
				row += count;
				break;
			}

			case 'G': {
				column = count - 1;
				break;
			}

			case 'K': {
				lines[row] = parameters === '2' ? '' : lines[row].slice(0, column);
				break;
			}

			default:
				// Other sequences, like cursor visibility and synchronized output, do not change the text.
		}
	};

	const applyToken = token => {
		// eslint-disable-next-line no-control-regex, regexp/no-control-character
		const escape = /^\u{1B}\[(?<parameters>\??[\d;]*)(?<command>[A-Za-z])$/v.exec(token);

		if (escape) {
			applyEscape(escape.groups.parameters, escape.groups.command);
		} else if (token === '\n') {
			row++;
			column = 0;
		} else if (token === '\r') {
			column = 0;
		} else {
			lines[row] = lines[row].padEnd(column).slice(0, column) + token + lines[row].slice(column + token.length);
			column += token.length;
		}

		lines[row] ??= '';
	};

	return {
		isTTY,
		columns,
		rows,
		get writeCount() {
			return writeCount;
		},
		get written() {
			return written;
		},
		write(chunk) {
			writeCount++;
			written += chunk;

			// eslint-disable-next-line no-control-regex, regexp/no-control-character
			for (const token of String(chunk).split(/(?<token>\u{1B}\[\??[\d;]*[A-Za-z]|\n|\r)/v)) {
				if (token !== '') {
					applyToken(token);
				}
			}

			return true;
		},
		get screen() {
			const visible = lines.map(line => line.trimEnd());

			while (visible.length > 0 && visible.at(-1) === '') {
				visible.pop();
			}

			return visible.join('\n');
		},
	};
};

// Render tasks with the default renderer and return what stays on the screen, like after a failed run.
const render = (tasks, {width = 80} = {}) => {
	const terminal = createTerminal({columns: width});
	const renderer = createRenderer('default', {tasks, stream: terminal, clearOnSuccess: false});
	renderer.done(new Error('Failed'));
	return terminal.screen;
};

test('renders each state with its symbol', () => {
	const tasks = [
		createTask({title: 'Pending'}),
		createTask({title: 'Running', state: 'running'}),
		createTask({title: 'Completed', state: 'completed'}),
		createTask({title: 'Skipped', state: 'skipped'}),
		createTask({title: 'Failed', state: 'failed', error: new Error('Boom')}),
	];

	assert.equal(render(tasks), [
		'   Pending',
		' ⠋ Running',
		` ${successSymbol} Completed`,
		' ↓ Skipped [skipped]',
		` ${errorSymbol} Failed`,
		'   → Boom',
	].join('\n'));
});

test('does not render disabled tasks', () => {
	const tasks = [
		createTask({title: 'A', state: 'completed'}),
		createTask({title: 'Disabled', state: 'disabled'}),
		createTask({title: 'B', state: 'completed'}),
	];

	assert.equal(render(tasks), ` ${successSymbol} A\n ${successSymbol} B`);
});

test('renders nothing for an empty list', () => {
	assert.equal(render([]), '');
});

test('animates the spinner every 80 milliseconds', t => {
	t.mock.timers.enable({apis: ['setInterval']});

	const terminal = createTerminal();
	const tasks = [createTask({title: 'Running', state: 'running'})];
	const renderer = createRenderer('default', {tasks, stream: terminal, clearOnSuccess: false});
	const screens = [terminal.screen];

	t.mock.timers.tick(80);
	screens.push(terminal.screen);
	t.mock.timers.tick(80 * 8);
	screens.push(terminal.screen);
	t.mock.timers.tick(80);
	screens.push(terminal.screen);
	renderer.done(new Error('Failed'));

	// It starts over after the last frame.
	assert.deepEqual(screens, [' ⠋ Running', ' ⠙ Running', ' ⠏ Running', ' ⠋ Running']);
});

test('a running task shows the last line of its output', () => {
	const tasks = [createTask({title: 'Installing', state: 'running', output: 'first\nsecond\n\n'})];
	assert.equal(render(tasks), ' ⠋ Installing\n   → second');
});

test('a running task without output shows only its title', () => {
	assert.equal(render([createTask({state: 'running'})]), ' ⠋ Task');
	assert.equal(render([createTask({state: 'running', output: ''})]), ' ⠋ Task');
	assert.equal(render([createTask({state: 'running', output: '  \n \n'})]), ' ⠋ Task');
});

test('the output is shown as plain text', () => {
	const tasks = [createTask({state: 'running', output: '\u{1B}[32mgreen\u{1B}[39m and \u{1B}[1mbold\u{1B}[22m'})];
	assert.equal(render(tasks), ' ⠋ Task\n   → green and bold');

	const terminal = createTerminal();
	createRenderer('default', {tasks, stream: terminal, clearOnSuccess: false}).done(new Error('Failed'));
	assert.equal(terminal.written.includes('\u{1B}[32m'), false);
});

test('the output shows the last version of a line that redraws itself', () => {
	const tasks = [createTask({state: 'running', output: 'progress 10%\rprogress 50%\rprogress 90%'})];
	assert.equal(render(tasks), ' ⠋ Task\n   → progress 90%');

	const trailing = [createTask({state: 'running', output: 'progress 90%\r'})];
	assert.equal(render(trailing), ' ⠋ Task\n   → progress 90%');

	const windowsLineEndings = [createTask({state: 'running', output: 'first\r\nsecond\r\n'})];
	assert.equal(render(windowsLineEndings), ' ⠋ Task\n   → second');
});

test('a long output line is truncated to the width', () => {
	const tasks = [createTask({state: 'running', output: 'x'.repeat(100)})];
	const [, outputLine] = render(tasks, {width: 20}).split('\n');

	assert.equal(outputLine.length, 19);
	assert.equal(outputLine, `   → ${'x'.repeat(13)}…`);
});

test('a skipped task shows its reason', () => {
	const tasks = [createTask({title: 'Cleanup', state: 'skipped', output: '[Dry run] Not deleted.'})];
	assert.equal(render(tasks), ' ↓ Cleanup [skipped]\n   → [Dry run] Not deleted.');
});

test('a completed task does not show its output', () => {
	const tasks = [createTask({title: 'Done', state: 'completed', output: 'Old output'})];
	assert.equal(render(tasks), ` ${successSymbol} Done`);
});

test('a failed task shows the last line of its error', () => {
	const tasks = [createTask({state: 'failed', error: new Error('Command failed\n\nnpm error 404 Not Found\n')})];
	assert.equal(render(tasks), ` ${errorSymbol} Task\n   → npm error 404 Not Found`);
});

test('a failed task with a thrown value that is not an error', () => {
	assert.equal(render([createTask({state: 'failed', error: 'Text failure'})]), ` ${errorSymbol} Task\n   → Text failure`);
	assert.equal(render([createTask({state: 'failed', error: undefined})]), ` ${errorSymbol} Task\n   → undefined`);
});

test('subtasks are only shown when their parent failed', () => {
	const subtasks = [
		createTask({title: 'Sub done', state: 'completed'}),
		createTask({title: 'Sub failed', state: 'failed', error: new Error('Sub error')}),
		createTask({title: 'Sub pending'}),
	];

	assert.equal(render([createTask({title: 'Parent', state: 'running', subtasks})]), ' ⠋ Parent');
	assert.equal(render([createTask({title: 'Parent', state: 'completed', subtasks})]), ` ${successSymbol} Parent`);

	const failedParent = createTask({
		title: 'Parent', state: 'failed', error: new Error('Sub error'), subtasks,
	});
	assert.equal(render([failedParent]), [
		' ❯ Parent',
		`   ${successSymbol} Sub done`,
		`   ${errorSymbol} Sub failed`,
		'     → Sub error',
		'     Sub pending',
	].join('\n'));
});

test('nested failed subtasks are indented by level', () => {
	const deep = createTask({title: 'Deep', state: 'failed', error: new Error('Deep error')});
	const middle = createTask({
		title: 'Middle', state: 'failed', error: deep.error, subtasks: [deep],
	});
	const top = createTask({
		title: 'Top', state: 'failed', error: deep.error, subtasks: [middle],
	});

	assert.equal(render([top]), [
		' ❯ Top',
		'   ❯ Middle',
		`     ${errorSymbol} Deep`,
		'       → Deep error',
	].join('\n'));
});

test('a failed parent whose subtasks are all disabled shows no empty line', () => {
	const subtasks = [createTask({title: 'Disabled', state: 'disabled'})];
	const parent = createTask({
		title: 'Parent', state: 'failed', error: new Error('Failed'), subtasks,
	});
	assert.equal(render([parent, createTask({title: 'Next'})]), ' ❯ Parent\n   Next');
});

test('the default renderer draws the list and keeps it after success', async () => {
	const terminal = createTerminal();
	const tasks = new TaskList([
		{title: 'First', run() {}},
		{title: 'Skipped', skip: 'Not needed', run() {}},
	]);

	await tasks.run({renderer: 'default', stream: terminal});

	assert.equal(terminal.screen, [
		` ${successSymbol} First`,
		' ↓ Skipped [skipped]',
		'   → Not needed',
	].join('\n'));
});

test('the default renderer shows the running task and its output', async t => {
	t.mock.timers.enable({apis: ['setInterval']});

	const terminal = createTerminal();
	const {promise: gate, resolve: openGate} = Promise.withResolvers();
	const tasks = new TaskList([
		{title: 'First', run() {}},
		{
			title: 'Second',
			async run(task) {
				task.output = 'Working on it';
				await gate;
			},
		},
		{title: 'Third', run() {}},
	]);

	const running = tasks.run({renderer: 'default', stream: terminal});

	await waitForImmediate();
	t.mock.timers.tick(80);
	const screenWhileRunning = terminal.screen;
	openGate();
	await running;

	assert.equal(screenWhileRunning, [
		` ${successSymbol} First`,
		' ⠙ Second',
		'   → Working on it',
		'   Third',
	].join('\n'));
});

test('the default renderer clears the list after success with `clearOnSuccess`, and keeps what was printed before', async () => {
	const terminal = createTerminal();
	terminal.write('Before the list\n');

	await new TaskList([{title: 'A', run() {}}, {title: 'B', run() {}}]).run({renderer: 'default', stream: terminal, clearOnSuccess: true});

	assert.equal(terminal.screen, 'Before the list');
});

test('the default renderer keeps the list after a failure with `clearOnSuccess`', async () => {
	const terminal = createTerminal();
	terminal.write('Before the list\n');

	const tasks = new TaskList([
		{title: 'A', run() {}},
		{
			title: 'B',
			run() {
				throw new Error('Something broke');
			},
		},
		{title: 'C', run() {}},
	]);

	await assert.rejects(tasks.run({renderer: 'default', stream: terminal, clearOnSuccess: true}), {message: 'Something broke'});

	assert.equal(terminal.screen, [
		'Before the list',
		` ${successSymbol} A`,
		` ${errorSymbol} B`,
		'   → Something broke',
		'   C',
	].join('\n'));
});

test('the default renderer keeps the whole list after a failure, even when it is taller than the terminal', async () => {
	const terminal = createTerminal({rows: 4});
	const definitions = Array.from({length: 6}, (_, index) => ({title: `Task ${index + 1}`, run() {}}));

	const tasks = new TaskList([
		...definitions,
		{
			title: 'Last',
			run() {
				throw new Error('Failed');
			},
		},
	]);

	await assert.rejects(tasks.run({renderer: 'default', stream: terminal}));

	assert.equal(terminal.screen, [
		...definitions.map(({title}) => ` ${successSymbol} ${title}`),
		` ${errorSymbol} Last`,
		'   → Failed',
	].join('\n'));
});

test('the default renderer shows the failed subtasks of a parent', async () => {
	const terminal = createTerminal();

	const tasks = new TaskList([{
		title: 'Checks',
		run: () => new TaskList([
			{title: 'Good', run() {}},
			{
				title: 'Bad',
				run() {
					throw new Error('Check failed');
				},
			},
		]),
	}]);

	await assert.rejects(tasks.run({renderer: 'default', stream: terminal}));

	assert.equal(terminal.screen, [
		' ❯ Checks',
		`   ${successSymbol} Good`,
		`   ${errorSymbol} Bad`,
		'     → Check failed',
	].join('\n'));
});

test('the default renderer clears the list during `withTerminal`, and lines printed then stay above the list', async () => {
	const terminal = createTerminal();
	let screenDuringCallback;

	const tasks = new TaskList([
		{title: 'Before', run() {}},
		{
			title: 'Rollback',
			async run(task) {
				await task.withTerminal(() => {
					screenDuringCallback = terminal.screen;
					terminal.write('Rolling back…\nRolled back.\n');
				});
			},
		},
	]);

	await tasks.run({renderer: 'default', stream: terminal});

	assert.equal(screenDuringCallback, '');
	assert.equal(terminal.screen, [
		'Rolling back…',
		'Rolled back.',
		` ${successSymbol} Before`,
		` ${successSymbol} Rollback`,
	].join('\n'));
});

test('the default renderer draws again after `withTerminal`', async t => {
	t.mock.timers.enable({apis: ['setInterval']});

	const terminal = createTerminal();
	const {promise: answered, resolve: markAnswered} = Promise.withResolvers();
	const {promise: gate, resolve: openGate} = Promise.withResolvers();

	const tasks = new TaskList([{
		title: 'Prompt',
		async run(task) {
			await task.withTerminal(() => {
				terminal.write('Answered\n');
			});

			markAnswered();
			await gate;
		},
	}]);

	const running = tasks.run({renderer: 'default', stream: terminal});
	await answered;

	const screens = [terminal.screen];
	t.mock.timers.tick(80);
	screens.push(terminal.screen);
	openGate();
	await running;

	// It draws right away, and keeps drawing on the timer.
	assert.deepEqual(screens, ['Answered\n ⠋ Prompt', 'Answered\n ⠙ Prompt']);
});

// Track whether the cursor is visible during the test. `log-update` hides the cursor on stderr.
const trackCursor = t => {
	const originalIsTTY = process.stderr.isTTY;
	process.stderr.isTTY = true;
	t.after(() => {
		process.stderr.isTTY = originalIsTTY;
	});

	const cursor = {isVisible: true};
	t.mock.method(process.stderr, 'write', chunk => {
		if (String(chunk).includes('\u{1B}[?25l')) {
			cursor.isVisible = false;
		}

		if (String(chunk).includes('\u{1B}[?25h')) {
			cursor.isVisible = true;
		}

		return true;
	});

	return cursor;
};

test('the default renderer hides the cursor while drawing, and shows it for `withTerminal` and at the end', async t => {
	const cursor = trackCursor(t);

	// The cursor visibility while drawing, during `withTerminal`, after it, and after the run.
	const recordCursorVisibility = async clearOnSuccess => {
		const visibility = [];
		const tasks = new TaskList([{
			title: 'Prompt',
			async run(task) {
				visibility.push(cursor.isVisible);
				await task.withTerminal(() => {
					visibility.push(cursor.isVisible);
				});
				visibility.push(cursor.isVisible);
			},
		}]);

		await tasks.run({renderer: 'default', stream: createTerminal(), clearOnSuccess});
		visibility.push(cursor.isVisible);

		return visibility;
	};

	assert.deepEqual(await recordCursorVisibility(false), [false, true, false, true]);
	assert.deepEqual(await recordCursorVisibility(true), [false, true, false, true]);
});

test('the default renderer stops drawing and shows the cursor when the process exits, for example on Ctrl+C', async t => {
	t.mock.timers.enable({apis: ['setInterval']});
	const cursor = trackCursor(t);

	let exitHandler;
	const removeExitHook = t.mock.fn();
	const {createRenderer: createRendererWithExitHook} = await esmock('../../source/task-list/renderers.js', {
		'exit-hook'(handler) {
			exitHandler = handler;
			return removeExitHook;
		},
	});

	const terminal = createTerminal();
	const renderer = createRendererWithExitHook('default', {tasks: [createTask({state: 'running'})], stream: terminal, clearOnSuccess: false});
	assert.equal(cursor.isVisible, false);

	exitHandler();
	assert.equal(cursor.isVisible, true);
	const {writeCount} = terminal;
	t.mock.timers.tick(1000);
	assert.equal(terminal.writeCount, writeCount, 'It should not draw over what the exit handlers print');

	renderer.done(new Error('Failed'));
	assert.equal(removeExitHook.mock.callCount(), 1);
});

test('the default renderer does not draw while paused', async t => {
	t.mock.timers.enable({apis: ['setInterval']});

	const terminal = createTerminal();
	const {promise: paused, resolve: markPaused} = Promise.withResolvers();
	const {promise: gate, resolve: openGate} = Promise.withResolvers();

	const tasks = new TaskList([{
		title: 'Prompt',
		run: task => task.withTerminal(async () => {
			markPaused();
			await gate;
		}),
	}]);

	const running = tasks.run({renderer: 'default', stream: terminal});
	await paused;

	const {writeCount} = terminal;
	t.mock.timers.tick(1000);
	assert.equal(terminal.writeCount, writeCount);

	openGate();
	await running;
});

test('the default renderer animates the spinner on a timer', async t => {
	t.mock.timers.enable({apis: ['setInterval']});

	const terminal = createTerminal();
	const {promise: gate, resolve: openGate} = Promise.withResolvers();
	const screens = [];

	const tasks = new TaskList([{title: 'Spinning', run: () => gate}]);
	const running = tasks.run({renderer: 'default', stream: terminal});

	await waitForImmediate();
	screens.push(terminal.screen);
	t.mock.timers.tick(80);
	screens.push(terminal.screen);
	t.mock.timers.tick(80);
	screens.push(terminal.screen);

	openGate();
	await running;

	// The first frame is drawn before the task starts.
	assert.deepEqual(screens, ['   Spinning', ' ⠙ Spinning', ' ⠹ Spinning']);
});

test('the default renderer stops its timer when the run ends', async t => {
	t.mock.timers.enable({apis: ['setInterval']});

	const terminal = createTerminal();
	await new TaskList([{title: 'A', run() {}}]).run({renderer: 'default', stream: terminal});

	const {writeCount} = terminal;
	t.mock.timers.tick(1000);
	assert.equal(terminal.writeCount, writeCount);
});

test('the default renderer truncates to 80 columns when the stream has no width', () => {
	const terminal = createTerminal();
	terminal.columns = undefined;

	const tasks = [createTask({state: 'running', output: 'y'.repeat(100)})];
	createRenderer('default', {tasks, stream: terminal, clearOnSuccess: false}).done(new Error('Failed'));

	const outputLine = terminal.screen.split('\n')[1];
	assert.equal(outputLine.length, 79);
	assert.ok(outputLine.endsWith('…'));
});

const timePattern = /^\[\d{2}:\d{2}:\d{2}\] /v;

const runVerbose = async (definitions, {shouldFail = false} = {}) => {
	const terminal = createTerminal({isTTY: false});
	const running = new TaskList(definitions).run({renderer: 'verbose', stream: terminal});

	await (shouldFail ? assert.rejects(running) : running);

	const lines = terminal.screen.split('\n');
	assert.ok(lines.every(line => timePattern.test(line)), `Every line should start with the time:\n${terminal.screen}`);
	assert.ok(!terminal.written.includes('\u{1B}'), 'The output should be plain text');

	return lines.map(line => line.replace(timePattern, ''));
};

test('the verbose renderer prints a line for each event', async () => {
	const lines = await runVerbose([
		{
			title: 'Build',
			run(task) {
				task.output = 'Compiling';
			},
		},
		{title: 'Cleanup', skip: 'Dry run', run() {}},
		{title: 'Quietly skipped', skip: true, run() {}},
		{title: 'Disabled', enabled: false, run() {}},
	]);

	assert.deepEqual(lines, [
		'Build [started]',
		'→ Compiling',
		'Build [completed]',
		'Cleanup [started]',
		'Cleanup [skipped]',
		'→ Dry run',
		'Quietly skipped [started]',
		'Quietly skipped [skipped]',
	]);
});

test('the verbose renderer prints each line of a failure', async () => {
	const lines = await runVerbose([{
		title: 'Publish',
		run() {
			throw new Error('Command failed\n\nnpm error 403');
		},
	}], {shouldFail: true});

	assert.deepEqual(lines, [
		'Publish [started]',
		'Publish [failed]',
		'→ Command failed',
		'→ npm error 403',
	]);
});

test('the verbose renderer prints plain text', async () => {
	const lines = await runVerbose([{
		title: '\u{1B}[1mBold title\u{1B}[22m',
		async * run() {
			yield '\u{1B}[32mfirst\u{1B}[39m\nsecond';
			yield 'progress 10%\rprogress 100%';
			yield '';
		},
	}]);

	assert.deepEqual(lines, [
		'Bold title [started]',
		'→ first',
		'→ second',
		'→ progress 100%',
		'Bold title [completed]',
	]);
});

test('the verbose renderer prints the events of subtasks', async () => {
	const lines = await runVerbose([{
		title: 'Parent',
		run: () => new TaskList([{title: 'Child', run() {}}]),
	}]);

	assert.deepEqual(lines, [
		'Parent [started]',
		'Child [started]',
		'Child [completed]',
		'Parent [completed]',
	]);
});

test('the verbose renderer prints the error of a failed subtask once', async () => {
	const lines = await runVerbose([{
		title: 'Parent',
		run: () => new TaskList([{
			title: 'Child',
			run() {
				throw new Error('Child failed');
			},
		}]),
	}], {shouldFail: true});

	assert.deepEqual(lines, [
		'Parent [started]',
		'Child [started]',
		'Child [failed]',
		'→ Child failed',
		'Parent [failed]',
	]);
});

test('the verbose renderer prints all events before the run resolves', async () => {
	const terminal = createTerminal({isTTY: false});
	const definitions = Array.from({length: 50}, (_, index) => ({title: `Task ${index}`, run() {}}));

	await new TaskList(definitions).run({renderer: 'verbose', stream: terminal});

	assert.equal(terminal.screen.split('\n').length, 100);
});

test('the silent renderer prints nothing', async () => {
	const terminal = createTerminal();

	await new TaskList([
		{title: 'A', run: task => task.withTerminal(() => {})},
	]).run({renderer: 'silent', stream: terminal});

	assert.equal(terminal.writeCount, 0);
});

const withEnvironment = async (environment, callback) => {
	const original = {...process.env};

	for (const [key, value] of Object.entries(environment)) {
		if (value === undefined) {
			delete process.env[key];
		} else {
			process.env[key] = value;
		}
	}

	try {
		await callback();
	} finally {
		for (const key of Object.keys(environment)) {
			if (original[key] === undefined) {
				delete process.env[key];
			} else {
				process.env[key] = original[key];
			}
		}
	}
};

test('the verbose renderer is used by default when the stream is not a terminal', async () => {
	const terminal = createTerminal({isTTY: false});
	await new TaskList([{title: 'A', run() {}}]).run({stream: terminal});

	assert.ok(terminal.screen.endsWith('A [completed]'));
});

test('the default renderer is used by default in an interactive terminal', async () => {
	await withEnvironment({CI: undefined, TERM: 'xterm-256color'}, async () => {
		const terminal = createTerminal();
		await new TaskList([{title: 'A', run() {}}]).run({stream: terminal});

		assert.equal(terminal.screen, ` ${successSymbol} A`);
	});
});

test('the verbose renderer is used by default in CI', async () => {
	await withEnvironment({CI: 'true'}, async () => {
		const terminal = createTerminal();
		await new TaskList([{title: 'A', run() {}}]).run({stream: terminal});

		assert.ok(terminal.screen.endsWith('A [completed]'));
	});
});

test('`createRenderer` returns a custom renderer as is', () => {
	const custom = {};
	assert.equal(createRenderer(() => custom, {}), custom);
});

test('`createRenderer` rejects unknown names, including inherited properties', () => {
	assert.throws(() => createRenderer('toString', {}), {message: 'Unknown renderer: `toString`'});
});
