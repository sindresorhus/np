import {execa} from 'execa';
import Version from '../version.js';
import handleNpmError from './handle-npm-error.js';
import {npmNetworkTimeout, version as npmVersionCheck} from './util.js';

export const getEnable2faArguments = async (packageName, options) => {
	const npmVersion = await npmVersionCheck();
	const arguments_ = new Version(npmVersion).satisfies('>=9.0.0')
		? ['access', 'set', 'mfa=publish', packageName]
		: ['access', '2fa-required', packageName];

	if (options && options.otp) {
		arguments_.push('--otp', options.otp);
	}

	// Npm only shows the browser authentication URLs in its JSON output.
	arguments_.push('--json');

	return arguments_;
};

const enable2fa = async (packageName, options) => execa('npm', await getEnable2faArguments(packageName, options), {timeout: npmNetworkTimeout});

export default async function tryEnable2fa(task, packageName, options) {
	await enable2fa(packageName, options).catch(error => handleNpmError(error, task, otp => enable2fa(packageName, {otp})));
}
