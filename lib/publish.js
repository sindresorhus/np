'use strict';
const execa = require('execa');
const listrInput = require('listr-input');
const Observable = require('any-observable');
const chalk = require('chalk');

const npmPublish = options => {
	const args = ['publish'];

	if (options.contents) {
		args.push(options.contents);
	}

	if (options.tag) {
		args.push('--tag', options.tag);
	}

	if (options.otp) {
		args.push('--otp', options.otp);
	}

	return execa('npm', args);
};

const handleError = (task, err, options, message) => {
	if (err.stderr.includes('one-time pass')) {
		const {title} = task;
		task.title = `${title} ${chalk.yellow('(waiting for input…)')}`;

		return listrInput(message || 'Enter OTP:', {
			done: otp => {
				task.title = title;
				return npmPublish(Object.assign({otp}, options));
			}
		}).catch(err => handleError(task, err, options, 'OTP was incorrect, try again:'));
	}

	return Observable.throw(err);
};

const publish = (task, options) => Observable.fromPromise(npmPublish(options))
	.catch(err => handleError(task, err, options));

module.exports = publish;
