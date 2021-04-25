import listrInput from 'listr-input';
import chalk from 'chalk';
import * as rxjs from 'rxjs';
import {catchError} from 'rxjs/operators';
const {throwError} = rxjs;
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
		}).pipe(catchError(error => handleNpmError(error, task, 'OTP was incorrect, try again:', executor)));
	}

	return throwError(error);
};

export default handleNpmError;
