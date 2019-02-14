'use strict';
const execa = require('execa');
const {from} = require('rxjs');
const {catchError} = require('rxjs/operators');
const {handleNpmError} = require('./util');

const enable2fa = (packageName, options) => {
	const args = ['access', '2fa-required', packageName];

	if (options && options.otp) {
		args.push('--otp', options.otp);
	}

	return execa('npm', args);
};

module.exports = (task, packageName) =>
	from(enable2fa(packageName)).pipe(
		catchError(error => handleNpmError(error, task, otp => enable2fa(packageName, {otp})))
	);
