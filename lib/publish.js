'use strict';
const execa = require('execa');
const listrInput = require('listr-input');
const Observable = require('any-observable');

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

const handleError = (err, tag, message) => {
	if (err.stderr.indexOf('You must provide a one-time pass') !== -1) {
		message = message || 'Enter OTP:';

		return listrInput(message, {
			done: otp => npmPublish({tag, otp})
		}).catch(err => handleError(err, tag, 'OTP was incorrect, try again:'));
	}

	return Observable.throw(err);
};

const publish = tag => Observable.fromPromise(npmPublish({tag}))
	.catch(err => handleError(err, tag));

module.exports = publish;
