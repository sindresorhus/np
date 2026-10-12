import process from 'node:process';
import test from 'node:test';
import assert from 'node:assert/strict';
import esmock from 'esmock';
import handleNpmError from '../../source/npm/handle-npm-error.js';
import {runPublish} from '../../source/npm/publish.js';
import {TaskList} from '../../source/task-list/index.js';

const makeError = ({code, stdout, stderr}) => ({
	code,
	stdout: stdout ?? '',
	stderr: stderr ?? '',
});

const otpError = makeError({stderr: 'npm error code EOTP\nnpm error This operation requires a one-time password from your authenticator.'});

test('error code 402 - privately publish scoped package', async () => {
	await assert.rejects(
		handleNpmError(makeError({code: 402})),
		{message: 'You cannot publish a scoped package privately without a paid plan. Did you mean to publish publicly?'},
	);

	await assert.rejects(
		handleNpmError(makeError({stderr: 'npm ERR! 402 Payment Required'})),
		{message: 'You cannot publish a scoped package privately without a paid plan. Did you mean to publish publicly?'},
	);
});

test('error code 402 - npm 10+ log prefix', async () => {
	await assert.rejects(
		handleNpmError(makeError({stderr: 'npm error code E402\nnpm error 402 Payment Required - PUT https://registry.npmjs.org/@scope%2fname - You must sign up for private packages'})),
		{message: 'You cannot publish a scoped package privately without a paid plan. Did you mean to publish publicly?'},
	);
});

// Load `handleNpmError` with an OTP prompt that answers with `answer`, and a task that records when the terminal is used.
const setUpOtpPrompt = async ({answer = async () => '123456', isStdinTTY = true} = {}) => {
	const prompts = [];

	const task = {
		isUsingTerminal: false,
		async withTerminal(callback) {
			task.isUsingTerminal = true;

			try {
				return await callback();
			} finally {
				task.isUsingTerminal = false;
			}
		},
	};

	const otpPrompt = async (config, context) => {
		prompts.push({message: config.message, context, isUsingTerminal: task.isUsingTerminal});
		return answer();
	};

	const {default: handleNpmErrorWithPrompt} = await esmock('../../source/npm/handle-npm-error.js', {
		'../../source/npm/otp-prompt.js': otpPrompt,
	});

	// Set `process.stdin.isTTY` while the function runs, as the test runner does not give it a terminal.
	const handleNpmErrorWithTTY = async (...arguments_) => {
		const originalIsTTY = process.stdin.isTTY;
		process.stdin.isTTY = isStdinTTY;

		try {
			return await handleNpmErrorWithPrompt(...arguments_);
		} finally {
			process.stdin.isTTY = originalIsTTY;
		}
	};

	return {handleNpmError: handleNpmErrorWithTTY, prompts, task};
};

test('OTP retry waits for the executor and prompts again when the OTP is rejected', async () => {
	const {handleNpmError: handleNpmErrorWithPrompt, prompts, task} = await setUpOtpPrompt();

	let executorCalls = 0;
	const executor = async () => {
		executorCalls++;

		if (executorCalls === 1) {
			throw otpError;
		}
	};

	await handleNpmErrorWithPrompt(otpError, task, executor);

	assert.equal(executorCalls, 2);
	assert.deepEqual(prompts.map(({message}) => message), ['Enter OTP:', 'OTP was incorrect, try again:']);
});

test('a publishing task remains running through rejected OTPs until the subprocess succeeds', async t => {
	const {promise: retryPrompted, resolve: markRetryPrompted} = Promise.withResolvers();
	const {promise: answer, resolve: answerRetry} = Promise.withResolvers();
	t.after(() => answerRetry('654321'));
	let promptCount = 0;
	const {handleNpmError: handleNpmErrorWithPrompt, prompts} = await setUpOtpPrompt({
		async answer() {
			promptCount++;

			if (promptCount === 1) {
				return '123456';
			}

			markRetryPrompted();
			return answer;
		},
	});
	const script = `
if (process.argv[1] === '654321') {
	console.log('Published');
} else {
	console.error('npm error This operation requires a one-time password from your authenticator.');
	process.exitCode = 1;
}
`;
	const tasks = new TaskList([
		{
			title: 'Publishing',
			async run(task) {
				const publish = otp => runPublish([process.execPath, ['--eval', script, ...(otp ? [otp] : [])]], {task});
				await publish().catch(error => handleNpmErrorWithPrompt(error, task, publish));
			},
		},
		{title: 'After publishing', run() {}},
	]);
	const running = tasks.run({renderer: 'silent'});

	await retryPrompted;
	assert.deepEqual(tasks.tasks.map(task => task.state), ['running', 'pending']);

	answerRetry('654321');
	await running;
	assert.equal(tasks.tasks[0].output, 'Published\n');
	assert.deepEqual(tasks.tasks.map(task => task.state), ['completed', 'completed']);
	assert.deepEqual(prompts.map(({message}) => message), ['Enter OTP:', 'OTP was incorrect, try again:']);
});

test('OTP prompt takes the terminal and passes the OTP to the executor', async () => {
	const {handleNpmError: handleNpmErrorWithPrompt, prompts, task} = await setUpOtpPrompt({answer: async () => '654321'});

	let isUsingTerminalInExecutor;
	const result = await handleNpmErrorWithPrompt(otpError, task, async otp => {
		isUsingTerminalInExecutor = task.isUsingTerminal;
		return `published with ${otp}`;
	});

	assert.equal(result, 'published with 654321');
	assert.equal(prompts[0].isUsingTerminal, true);
	assert.deepEqual(prompts[0].context, {clearPromptOnDone: true});
	// The command runs again after the prompt gave back the terminal, so the task list shows its progress.
	assert.equal(isUsingTerminalInExecutor, false);
});

test('OTP prompt errors are thrown without running the executor', async () => {
	const {handleNpmError: handleNpmErrorWithPrompt, task} = await setUpOtpPrompt({
		async answer() {
			throw new Error('Prompt failed');
		},
	});

	let executorCalls = 0;
	const executor = async () => {
		executorCalls++;
	};

	await assert.rejects(
		handleNpmErrorWithPrompt(otpError, task, executor),
		{message: 'Prompt failed'},
	);

	assert.equal(executorCalls, 0);
	assert.equal(task.isUsingTerminal, false);
});

test('OTP retry that fails with a 402 error throws the paid plan error', async () => {
	const {handleNpmError: handleNpmErrorWithPrompt, prompts, task} = await setUpOtpPrompt();

	const yarnOtpError = makeError({stdout: 'Two factor authentication'});
	const executor = async () => {
		throw makeError({stderr: 'npm error 402 Payment Required'});
	};

	await assert.rejects(
		handleNpmErrorWithPrompt(yarnOtpError, task, executor),
		{message: 'You cannot publish a scoped package privately without a paid plan. Did you mean to publish publicly?'},
	);

	assert.equal(prompts.length, 1);
});

test('OTP retry that fails for another reason throws the retry error', async () => {
	const {handleNpmError: handleNpmErrorWithPrompt, prompts, task} = await setUpOtpPrompt();

	const retryError = makeError({stderr: 'npm error 404 Not Found'});
	const executor = async () => {
		throw retryError;
	};

	await assert.rejects(
		handleNpmErrorWithPrompt(otpError, task, executor),
		retryError,
	);

	assert.equal(prompts.length, 1);
});

test('Yarn berry OTP errors prompt for an OTP', async () => {
	const {handleNpmError: handleNpmErrorWithPrompt, prompts, task} = await setUpOtpPrompt();

	await handleNpmErrorWithPrompt(makeError({stdout: 'One-time password:'}), task, async () => {});

	assert.equal(prompts.length, 1);
});

test('OTP errors are rethrown without prompting when stdin is not a terminal', async () => {
	const {handleNpmError: handleNpmErrorWithPrompt, prompts, task} = await setUpOtpPrompt({isStdinTTY: false});

	await assert.rejects(
		handleNpmErrorWithPrompt(otpError, task, () => assert.fail('executor should not run')),
		otpError,
	);

	assert.equal(prompts.length, 0);
});

test('OTP prompt is shown in a terminal when the `CI` environment variable is set', async t => {
	t.mock.property(process, 'env', {...process.env, CI: 'true'});

	const {handleNpmError: handleNpmErrorWithPrompt, prompts, task} = await setUpOtpPrompt();
	await handleNpmErrorWithPrompt(otpError, task, async () => {});

	assert.equal(prompts.length, 1);
});

test('errors without stdout and stderr are rethrown', async () => {
	const error = new TypeError('Invalid options');

	await assert.rejects(
		handleNpmError(error, {title: 'Publishing package'}, () => assert.fail('executor should not run')),
		error,
	);
});

test('non-OTP errors are rethrown without prompting', async () => {
	const error = makeError({stderr: 'npm error 404 Not Found'});

	await assert.rejects(
		handleNpmError(error, {title: 'Publishing package'}, () => assert.fail('executor should not run')),
		error,
	);
});
