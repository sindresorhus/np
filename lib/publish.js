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

module.exports = tag => Observable.fromPromise(npmPublish({tag}))
	.catch(err => {
		if (err.stderr.indexOf('You must provide a one-time pass') !== -1) {
			return listrInput('Enter OTP', {
				done: otp => npmPublish({tag, otp})
			});
		}

		return Observable.throw(err);
	});
