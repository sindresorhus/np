import {execa} from 'execa';
import {from, catchError} from 'rxjs';
import handleNpmError from './handle-npm-error.js';

export const getPackagePublishArguments = (options, isYarnBerry) => {
	const args = isYarnBerry ? ['npm', 'publish'] : ['publish'];

	if (options.contents) {
		args.push(options.contents);
	}

	if (options.tag) {
		args.push('--tag', options.tag);
	}

	if (options.otp) {
		args.push('--otp', options.otp);
	}

	if (options.publishScoped) {
		args.push('--access', 'public');
	}

	return args;
};

const pkgPublish = (pkgManager, isYarnBerry, options) => execa(pkgManager, getPackagePublishArguments(options, isYarnBerry));

const publish = (context, pkgManager, isYarnBerry, task, options) =>
	from(pkgPublish(pkgManager, isYarnBerry, options)).pipe(
		catchError(error => handleNpmError(error, task, otp => {
			context.otp = otp;

			return pkgPublish(pkgManager, isYarnBerry, {...options, otp});
		})),
	);

export default publish;
