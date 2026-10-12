import process from 'node:process';
import test from 'node:test';
import assert from 'node:assert/strict';
import {PassThrough} from 'node:stream';
import {setImmediate as waitForImmediate} from 'node:timers/promises';
import stripAnsi from 'strip-ansi';
import otpPrompt from '../../source/npm/otp-prompt.js';

const enter = '\r';
const backspace = '\u{7F}';
const ctrlC = '\u{3}';

/**
Show the prompt with fake streams and type the given keys. Each item is written as one chunk, so a multi-character item is like a paste.

@param {string[]} keys - The keys to type.
@param {object} [context] - Extra context for the prompt.
@returns {Promise<{answer: string | undefined, error: unknown, output: string}>} The answer, or `undefined` if the prompt did not submit, and the error if the prompt was aborted.
*/
const typeIntoPrompt = async (keys, context = {}) => {
	const input = new PassThrough();
	const output = new PassThrough();
	let written = '';
	output.on('data', chunk => {
		written += chunk;
	});

	// Readline ignores Backspace in a dumb terminal, so do not depend on the terminal of the test run.
	const originalTerm = process.env.TERM;
	process.env.TERM = 'xterm';
	const prompt = otpPrompt({message: 'Enter OTP:'}, {input, output, ...context});

	if (originalTerm === undefined) {
		delete process.env.TERM;
	} else {
		process.env.TERM = originalTerm;
	}

	let answer;
	let error;
	prompt.then(value => {
		answer = value;
	}).catch(error_ => {
		error = error_;
	});

	// The prompt ignores input until its first render, which waits for one tick.
	await waitForImmediate();

	for (const key of keys) {
		input.write(key);
		// eslint-disable-next-line no-await-in-loop
		await waitForImmediate();
	}

	if (answer === undefined && error === undefined) {
		prompt.cancel();
	}

	return {answer, error, output: stripAnsi(written)};
};

test('submits by itself after 6 characters', async () => {
	const {answer} = await typeIntoPrompt(['1', '2', '3', '4', '5', '6']);
	assert.equal(answer, '123456');
});

test('submits a pasted code and shows it as the answer', async () => {
	const {answer, output} = await typeIntoPrompt(['654321']);
	assert.equal(answer, '654321');
	assert.match(output, /Enter OTP: 654321/v);
});

test('submits fewer characters with Enter', async () => {
	const {answer} = await typeIntoPrompt(['1', '2', '3', enter]);
	assert.equal(answer, '123');
});

test('submits the first 6 characters of a longer paste', async () => {
	const {answer} = await typeIntoPrompt(['12345678', enter]);
	assert.equal(answer, '123456');
});

test('ignores Enter without input', async () => {
	const {answer} = await typeIntoPrompt([enter, enter, '1', enter]);
	assert.equal(answer, '1');
});

test('ignores Enter with only spaces', async () => {
	const {answer} = await typeIntoPrompt(['  ', enter, '1', enter]);
	assert.equal(answer, '1');
});

test('does not submit before 6 characters', async () => {
	const {answer, output} = await typeIntoPrompt(['1', '2', '3', '4', '5']);
	assert.equal(answer, undefined);
	assert.match(output, /Enter OTP: 12345/v);
});

test('backspace removes a character', async () => {
	const {answer} = await typeIntoPrompt(['1', '2', backspace, '3', '4', '5', '6', '7']);
	assert.equal(answer, '134567');
});

test('ignores spaces around the code', async () => {
	const {answer} = await typeIntoPrompt([' 123 ', enter]);
	assert.equal(answer, '123');
});

test('Ctrl+C aborts the prompt', async () => {
	const {answer, error} = await typeIntoPrompt(['1', '2', ctrlC]);
	assert.equal(answer, undefined);
	// The CLI handles this error like for any other aborted prompt.
	assert.equal(error?.name, 'ExitPromptError');
});
