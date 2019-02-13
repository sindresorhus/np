'use strict';
const execa = require('execa');
const {from, EMPTY} = require('rxjs');
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
		catchError(error => {
			if (error.stderr.includes('access subcommand')) {
				task.skip('Upgrade npm to version 6.5.0 or higher to use this feature');

				return EMPTY;
			}

			return handleNpmError(error, task, otp => enable2fa(packageName, {otp}));
		})
	);
