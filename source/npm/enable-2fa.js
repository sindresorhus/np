'use strict';
const execa = require('execa');
const {from} = require('rxjs');
const {catchError} = require('rxjs/operators');
const NpmUserProfile = require('npm-user-profile');
const handleNpmError = require('./handle-npm-error');

const enable2fa = async (packageName, options) => {
	const profile = await NpmUserProfile.profile();
	if (profile['two-factor auth'] !== 'enabled') {
		return true;
	}

	const args = ['access', '2fa-required', packageName];

	if (options && options.otp) {
		args.push('--otp', options.otp);
	}

	return execa('npm', args);
};

module.exports = (task, packageName, options) =>
	from(enable2fa(packageName, options)).pipe(
		catchError(error => handleNpmError(error, task, otp => enable2fa(packageName, {otp})))
	);
