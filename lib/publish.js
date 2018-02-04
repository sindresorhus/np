'use strict';
const execa = require('execa');
const listrInput = require('listr-input');
const Observable = require('any-observable');
const chalk = require('chalk');

const npmPublish = opts => {
	const args = ['publish'];

	if (opts.tag) {
		args.push('--tag', opts.tag);
	}

	if (opts.otp) {
		args.push('--otp', opts.otp);
	}

	return execa('npm', args);
};

const handleError = (task, err, tag, message) => {
	if (err.stderr.indexOf('one-time pass') !== -1) {
		const title = task.title;
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
