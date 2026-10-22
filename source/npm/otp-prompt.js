import {
	createPrompt,
	useState,
	useKeypress,
	usePrefix,
	isEnterKey,
	makeTheme,
} from '@inquirer/core';

// Authenticator apps show 6 digits.
const otpLength = 6;

/**
Prompt for a one-time password. It submits when Enter is pressed, or by itself when 6 characters are entered. With `allowEmpty`, Enter without input submits an empty string.

@type {import('@inquirer/core').Prompt<string, {message: string; allowEmpty?: boolean}>}
*/
const otpPrompt = createPrompt((config, done) => {
	const theme = makeTheme();
	const [status, setStatus] = useState('idle');
	const [value, setValue] = useState('');
	const prefix = usePrefix({status, theme});

	useKeypress((key, readline) => {
		if (status !== 'idle') {
			return;
		}

		const isEnter = isEnterKey(key);

		// Readline clears its line when Enter is pressed, so use the value from before.
		const answer = (isEnter ? value : readline.line).trim();

		if (answer.length === otpLength || (isEnter && (answer !== '' || config.allowEmpty))) {
			setValue(answer);
			setStatus('done');
			done(answer);
			return;
		}

		setValue(readline.line);
	});

	const message = theme.style.message(config.message, status);
	const formattedValue = status === 'done' ? theme.style.answer(value) : value;
	return `${prefix} ${message} ${formattedValue}`;
});

export default otpPrompt;
