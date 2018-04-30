'use strict';
const execa = require('execa');
const listrInput = require('listr-input');
const Observable = require('any-observable');
const chalk = require('chalk');

const npmPublish = options => {
	const args = ['publish'];

	if (options.tag) {
		args.push('--tag', options.tag);
	}

	if (options.otp) {
		args.push('--otp', options.otp);
	}

	return execa('npm', args);
};

const handleError = (task, err, tag, message) => {
	if (err.stderr.includes('one-time pass')) {
		const {title} = task;
		task.title = `${title} ${chalk.yellow('(waiting for input…)')}`;

		return listrInput(message || 'Enter OTP:', {
			done: otp => {
				task.title = title;
				return npmPublish({tag, otp});
			}
		}).catch(err => handleError(task, err, tag, 'OTP was incorrect, try again:'));
	}

	return Observable.throw(err);
};

const publish = (task, tag) => Observable.fromPromise(npmPublish({tag}))
	.catch(err => handleError(task, err, tag));

module.exports = publish;
