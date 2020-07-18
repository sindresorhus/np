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

	return throwError(error);
};

module.exports = handleNpmError;
