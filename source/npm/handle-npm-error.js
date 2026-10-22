import process from 'node:process';
import {setTimeout as delay} from 'node:timers/promises';
import open from 'open';
import otpPrompt from './otp-prompt.js';

/**
Get the browser authentication URLs that npm prints with `--json` when the registry offers browser authentication, which accounts with only a passkey need. npm masks them as `***` in stderr.

@param {{stdout?: string}} error - The error from the command.
@returns {{authUrl: string; doneUrl: string} | undefined} The URLs, or `undefined` if npm did not print them.
*/
const getBrowserAuthentication = error => {
	// Not `JSON.parse`, as lifecycle scripts can print other text to stdout before the JSON. Only HTTPS URLs are opened and fetched.
	const authUrl = error.stdout?.match(/"authUrl":\s*"(?<url>https:\/\/[^"]+)"/v)?.groups.url;
	const doneUrl = error.stdout?.match(/"doneUrl":\s*"(?<url>https:\/\/[^"]+)"/v)?.groups.url;
	return authUrl && doneUrl ? {authUrl, doneUrl} : undefined;
};

/**
Open the browser authentication page and wait until the user has authenticated. Like npm, it polls `doneUrl`, which needs no npm token, until it returns the token that npm accepts as the OTP.

@param {{authUrl: string; doneUrl: string}} browserAuthentication - The URLs from npm.
@param {import('../task-list/index.js').Task} task - The task that shows the URL, in case the browser does not open.
@returns {Promise<string>} The token.
*/
const authenticateInBrowser = async ({authUrl, doneUrl}, task) => {
	// The URL is on its own line, as the task list shows only the last line of the output, cut to the terminal width.
	task.output = `Waiting for authentication in the browser:\n${authUrl}`;

	try {
		await open(authUrl);
	} catch {
		// The task output shows the URL, so the user can open it themselves.
	}

	while (true) {
		// eslint-disable-next-line no-await-in-loop
		const response = await fetch(doneUrl);

		if (response.status === 202) {
			// eslint-disable-next-line no-await-in-loop
			await delay((Number(response.headers.get('retry-after')) || 1) * 1000);
			continue;
		}

		// eslint-disable-next-line no-await-in-loop
		const {token} = response.ok ? await response.json() : {};
		if (!token) {
			throw new Error(`Browser authentication failed with status ${response.status}.`);
		}

		return token;
	}
};

/**
Prompts for an OTP when the command failed because it needs one, and runs `executor` again with it.

When npm offers browser authentication, it opens the browser instead, and `executor` gets the token from it as the OTP. With the `NP_OTP_PROMPT` environment variable, and after a rejected OTP, it prompts for an OTP first, and Enter without an OTP opens the browser.

@param {{code?: unknown; stdout?: string; stderr?: string}} error - The error from the command.
@param {import('../task-list/index.js').Task} task - The task that runs the command.
@param {(otp: string) => Promise<unknown>} executor - Runs the command again with the OTP.
*/
export default async function handleNpmError(error, task, executor) {
	let isRetry = false;

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

		const browserAuthentication = getBrowserAuthentication(error);

		let otp;

		// Users with an authenticator app can set `NP_OTP_PROMPT` to enter the OTP in the terminal instead of in the browser. A retry also prompts, so the user sees that the OTP was rejected, and the browser does not open again by itself.
		if (!browserAuthentication || process.env.NP_OTP_PROMPT || isRetry) {
			const message = isRetry ? 'OTP was incorrect, try again' : 'Enter OTP';

			// eslint-disable-next-line no-await-in-loop
			otp = await task.withTerminal(() => otpPrompt({
				message: browserAuthentication ? `${message} (or press Enter to authenticate in the browser):` : `${message}:`,
				allowEmpty: Boolean(browserAuthentication),
			}, {clearPromptOnDone: true}));
		}

		// The prompt only gives an empty OTP when browser authentication is available.
		// eslint-disable-next-line no-await-in-loop
		otp ||= await authenticateInBrowser(browserAuthentication, task);

		// Get the OTP and then run the executor, so the prompt is closed before the command runs again, and a failed retry goes back through the OTP loop.
		try {
			// eslint-disable-next-line no-await-in-loop
			return await executor(otp);
		} catch (otpError) {
			error = otpError;
			isRetry = true;
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
