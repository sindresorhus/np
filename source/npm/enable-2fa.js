import {execa} from 'execa';
import {from, catchError} from 'rxjs';
import Version from '../version.js';
import handleNpmError from './handle-npm-error.js';
import {version as npmVersionCheck} from './util.js';

export const getEnable2faArguments = async (packageName, options) => {
	const npmVersion = await npmVersionCheck();
	const arguments_ = new Version(npmVersion).satisfies('>=9.0.0')
		? ['access', 'set', 'mfa=publish', packageName]
		: ['access', '2fa-required', packageName];

	if (options && options.otp) {
		arguments_.push('--otp', options.otp);
	}

	return arguments_;
};

const enable2fa = (packageName, options) => execa('npm', getEnable2faArguments(packageName, options));

const tryEnable2fa = (task, packageName, options) => {
	from(enable2fa(packageName, options)).pipe(
		catchError(error => handleNpmError(error, task, otp => enable2fa(packageName, {otp}))),
	);
};

export default tryEnable2fa;
