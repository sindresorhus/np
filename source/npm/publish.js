import {execa} from 'execa';

export const getPackagePublishArguments = options => {
	const arguments_ = ['publish'];

	if (options.tag) {
		arguments_.push('--tag', options.tag);
	}

	if (options.otp) {
		arguments_.push('--otp', options.otp);
	}

	if (options.publishScoped) {
		arguments_.push('--access', 'public');
	}

	return arguments_;
};

export function runPublish(arguments_, options = {}) {
	const execaOptions = {};

	// `npm` 8.5+ has a bug where `npm publish <folder>` publishes from cwd instead of <folder>.
	// We work around this by changing cwd to the target directory.
	// https://github.com/npm/cli/issues/5136
	if (options.cwd) {
		execaOptions.cwd = options.cwd;
	}

	const cp = execa(...arguments_, execaOptions);

	cp.stdout.on('data', chunk => {
		// https://github.com/yarnpkg/berry/blob/a3e5695186f2aec3a68810acafc6c9b1e45191da/packages/plugin-npm/sources/npmHttpUtils.ts#L541
		if (chunk.toString('utf8').includes('One-time password:')) {
			cp.kill();
		}
	});

	return cp;
}
