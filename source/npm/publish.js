export const getPackagePublishArguments = options => {
	const arguments_ = ['publish'];

	if (options.contents) {
		arguments_.push(options.contents);
	}

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
