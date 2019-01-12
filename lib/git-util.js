'use strict';
const execa = require('execa');

const latestTag = () => execa.stdout('git', ['describe', '--abbrev=0']);
const firstCommit = () => execa.stdout('git', ['rev-list', '--max-parents=0', 'HEAD']);

exports.latestTagOrFirstCommit = async () => {
	let latest;
	try {
		// In case a previous tag exists, we use it to compare the current repo status to.
		latest = await latestTag();
	} catch (_) {
		// Otherwise, we fallback to using the first commit for comparison.
		latest = await firstCommit();
	}

	return latest;
};

exports.hasUpstream = async () => {
	const {stdout} = await execa('git', ['status', '--short', '--branch', '--porcelain=2']);
	return /^# branch\.upstream [\w\-/]+$/m.test(stdout);
};
