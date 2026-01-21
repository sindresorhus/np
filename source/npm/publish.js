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

// 3 minutes timeout for publish operations (like git network operations)
// Publishing can take time for large packages or slow connections
const publishTimeout = 180_000;

export function runPublish(arguments_, options = {}) {
	const execaOptions = {
		// Inherit stdin to allow password/OTP prompts from npm/yarn
		stdin: 'inherit',
		// Timeout to prevent infinite hangs (e.g., from lifecycle scripts in watch mode)
		timeout: publishTimeout,
	};

	// `npm` 8.5+ has a bug where `npm publish <folder>` publishes from cwd instead of <folder>.
	// We work around this by changing cwd to the target directory.
	// https://github.com/npm/cli/issues/5136
	if (options.cwd) {
		execaOptions.cwd = options.cwd;
	}

	return execa(...arguments_, execaOptions);
}
