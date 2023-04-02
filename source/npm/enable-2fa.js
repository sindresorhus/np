import {execa} from 'execa';
import {from, catchError} from 'rxjs';
import handleNpmError from './handle-npm-error.js';

export const getEnable2faArgs = (packageName, options) => {
	const args = ['access', '2fa-required', packageName];

	if (options && options.otp) {
		args.push('--otp', options.otp);
	}

	return args;
};

const enable2fa = (packageName, options) => execa('npm', getEnable2faArgs(packageName, options));

const tryEnable2fa = (task, packageName, options) => {
	from(enable2fa(packageName, options)).pipe(
		catchError(error => handleNpmError(error, task, otp => enable2fa(packageName, {otp})))
	);
};

export default tryEnable2fa;
