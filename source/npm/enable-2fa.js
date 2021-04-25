import execa from 'execa';
import * as rxjs from 'rxjs';
import {catchError} from 'rxjs/operators';
import handleNpmError from './handle-npm-error';

const {from} = rxjs;
const getEnable2faArgs = (packageName, options) => {
	const args = ['access', '2fa-required', packageName];
	if (options && options.otp) {
		args.push('--otp', options.otp);
	}

	return args;
};

const enable2fa = (packageName, options) => execa('npm', getEnable2faArgs(packageName, options));
const enable2faForPkg = (task, packageName, options) => from(enable2fa(packageName, options)).pipe(catchError(error => handleNpmError(error, task, otp => enable2fa(packageName, {otp}))));
export default enable2faForPkg;
export {getEnable2faArgs};
