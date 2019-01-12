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
	const stdout = await execa.stdout('git', ['status', '--short', '--branch', '--porcelain=2']);
	return /^# branch\.upstream [\w\-/]+$/m.test(stdout);
};

exports.currentBranch = () => execa.stdout('git', ['symbolic-ref', '--short', 'HEAD']);

exports.isWorkingTreeClean = async () => {
	try {
		const status = await execa.stdout('git', ['status', '--porcelain']);
		if (status !== '') {
			return false;
		}

		return true;
	} catch (_) {
		return false;
	}
};

exports.remoteHistoryClean = async () => {
	let stdout;
	try { // Gracefully handle no remote set up.
		stdout = await execa.stdout('git', ['rev-list', '--count', '--left-only', '@{u}...HEAD']);
	} catch (_) {}

	if (stdout && stdout !== '0') {
		return false;
	}

	return true;
};

exports.validRemote = async () => {
	try {
		await execa('git', ['ls-remote', 'origin', 'HEAD']);
		return true;
	} catch (error) {
		return error.stderr.replace('fatal:', 'Git fatal error:');
	}
};

exports.fetchRemote = () => execa('git', ['fetch']);

exports.doesTagExist = async tagName => {
	try {
		const revInfo = await execa.stdout('git', ['rev-parse', '--quiet', '--verify', `refs/tags/${tagName}`]);

		if (revInfo) {
			return new Error(`Git tag \`${tagName}\` already exists.`);
		}

		return false;
	} catch (error) {
		// Command fails with code 1 and no output if the tag does not exist, even though `--quiet` is provided
		// https://github.com/sindresorhus/np/pull/73#discussion_r72385685
		if (error.stdout !== '' || error.stderr !== '') {
			return error;
		}

		return false;
	}
};

exports.commitLog = start => execa.stdout('git', ['log', '--format=%s %h', `${start}..HEAD`]);
