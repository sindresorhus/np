'use strict';
const execa = require('execa');
const listrInput = require('listr-input');
const {throwError, from} = require('rxjs');
const {catchError} = require('rxjs/operators');
const chalk = require('chalk');

const pkgPublish = (pkgManager, options, input) => {
	const args = ['publish'];

	if (options.contents) {
		args.push(options.contents);
	}

	if (options.yarn) {
		args.push('--new-version', input);
	}

	if (options.tag) {
		args.push('--tag', options.tag);
	}

	if (options.otp) {
		args.push('--otp', options.otp);
	}

	if (options.publishScoped) {
		args.push('--access', 'public');
	}

	return execa(pkgManager, args);
};

const handleError = (err, pkgManager, task, options, input, message) => {
	if (err.stderr.includes('one-time pass') || err.message.includes('user TTY')) {
		const {title} = task;
		task.title = `${title} ${chalk.yellow('(waiting for input…)')}`;

		return listrInput(message || 'Enter OTP:', {
			done: otp => {
				task.title = title;
				return pkgPublish(pkgManager, Object.assign({otp}, options), input);
			}
		}).pipe(
			catchError(err => handleError(err, pkgManager, task, options, input, 'OTP was incorrect, try again:'))
		);
	}

	return throwError(err);
};

const publish = (pkgManager, task, options, input) =>
	from(pkgPublish(pkgManager, options, input)).pipe(
		catchError(err => handleError(err, pkgManager, task, options, input))
	);

module.exports = publish;
