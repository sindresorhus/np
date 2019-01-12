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

exports.currentBranch = () => execa.stdout('git', ['symbolic-ref', '--short', 'HEAD']);

exports.isWorkingTreeClean = async () => {
	try {
		const {stdout: status} = await execa('git', ['status', '--porcelain']);
		if (status !== '') {
			return false;
		}

		return true;
	} catch (_) {
		return false;
	}
};

exports.isRemoteHistoryClean = async () => {
	let history;
	try { // Gracefully handle no remote set up.
		history = await execa.stdout('git', ['rev-list', '--count', '--left-only', '@{u}...HEAD']);
	} catch (_) {}

	if (history && history !== '0') {
		return false;
	}

	return true;
};

exports.verifyRemoteIsValid = async () => {
	try {
		await execa('git', ['ls-remote', 'origin', 'HEAD']);
	} catch (error) {
		throw error.stderr.replace('fatal:', 'Git fatal error:');
	}
};

exports.fetchRemote = () => execa('git', ['fetch']);

exports.tagExists = async tagName => {
	try {
		const {stdout: revInfo} = await execa('git', ['rev-parse', '--quiet', '--verify', `refs/tags/${tagName}`]);

		if (revInfo) {
			return true;
		}

		return false;
	} catch (error) {
		// Command fails with code 1 and no output if the tag does not exist, even though `--quiet` is provided
		// https://github.com/sindresorhus/np/pull/73#discussion_r72385685
		if (error.stdout !== '' || error.stderr !== '') {
			throw error;
		}

		return false;
	}
};

exports.verifyTagDoesntExist = async tagName => {
	if (await exports.tagExists(tagName)) {
		throw new Error(`Git tag \`${tagName}\` already exists.`);
	}
};

exports.commitLogFromRevision = revision => execa.stdout('git', ['log', '--format=%s %h', `${revision}..HEAD`]);
