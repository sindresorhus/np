const listrInput = require('listr-input');
const chalk = require('chalk');
const {throwError} = require('rxjs');
const {catchError} = require('rxjs/operators');

const handleNpmError = (error, task, message, executor) => {
	if (typeof message === 'function') {
		executor = message;
		message = undefined;
	}

	// `one-time pass` is for npm and `Two factor authentication` is for Yarn.
	if (error.stderr.includes('one-time pass') || error.stdout.includes('Two factor authentication')) {
		const {title} = task;
		task.title = `${title} ${chalk.yellow('(waiting for input…)')}`;

		return listrInput('Enter OTP:', {
			done: otp => {
				task.title = title;
				return executor(otp);
			},
			autoSubmit: value => value.length === 6
		}).pipe(
			catchError(error => handleNpmError(error, task, 'OTP was incorrect, try again:', executor))
		);
	}

	// Attempting to privately publish a scoped package without the correct npm plan
	// https://stackoverflow.com/a/44862841/10292952
	if (error.code === 402 || error.stderr.includes('npm ERR! 402 Payment Required')) {
		throw new Error('You cannot publish a privately scoped package without a paid plan. Did you mean to publish publicly?');
	}

	return throwError(error);
};

module.exports = handleNpmError;
