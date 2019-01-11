'use strict';
const execa = require('execa');

exports.getLatestTag = async () => {
	let latest;
	try {
		// In case a previous tag exists, we use it to compare the current repo status to.
		latest = await execa.stdout('git', ['describe', '--abbrev=0']);
	} catch (_) {
		// Otherwise, we fallback to using the first commit for comparison.
		latest = await execa.stdout('git', ['rev-list', '--max-parents=0', 'HEAD']);
	}

	return latest;
};
