import process from 'node:process';
import otpPrompt from './otp-prompt.js';

export default async function handleNpmError(error, task, executor) {
	let message = 'Enter OTP:';

	// `one-time pass` is for npm and `Two factor authentication` is for Yarn.
	while (
		error.stderr?.includes('one-time pass') // Npm
		|| error.stdout?.includes('Two factor authentication') // Yarn v1
		|| error.stdout?.includes('One-time password:') // Yarn berry
	) {
		// Nobody can enter an OTP without a terminal, so fail instead of waiting forever. Check stdin, as the output can go to a pipe, like with `np | tee log`, while the user can still type.
		// Not `is-interactive`, as it is `false` when the `CI` environment variable is set, even in a terminal.
		if (!process.stdin.isTTY) {
			break;
		}

		// Get the OTP and then run the executor, so the prompt is closed before the command runs again, and a failed retry goes back through the OTP loop.
		// eslint-disable-next-line no-await-in-loop
		const otp = await task.withTerminal(() => otpPrompt({message}, {clearPromptOnDone: true}));

		try {
			// eslint-disable-next-line no-await-in-loop
			return await executor(otp);
		} catch (otpError) {
			error = otpError;
			message = 'OTP was incorrect, try again:';
		}
	}

	// Attempting to privately publish a scoped package without the correct npm plan
	// https://stackoverflow.com/a/44862841/10292952
	if (
		error.code === 402
		|| error.stderr?.includes('402 Payment Required') // Npm/pnpm (prefixed with `npm ERR!` before npm 10 and `npm error` since)
		|| error.stdout?.includes('Response Code: 402 (Payment Required)') // Yarn Berry
	) {
		throw new Error('You cannot publish a scoped package privately without a paid plan. Did you mean to publish publicly?');
	}

	throw error;
}
