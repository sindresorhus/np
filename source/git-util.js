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

exports.verifyCurrentBranchIsMaster = async () => {
	if (await exports.currentBranch() !== 'master') {
		throw new Error('Not on `master` branch. Use --any-branch to publish anyway.');
	}
};

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

exports.verifyWorkingTreeIsClean = async () => {
	if (!(await exports.isWorkingTreeClean())) {
		throw new Error('Unclean working tree. Commit or stash changes first.');
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

exports.verifyRemoteHistoryIsClean = async () => {
	if (!(await exports.isRemoteHistoryClean())) {
		throw new Error('Remote history differs. Please pull changes.');
	}
};

exports.verifyRemoteIsValid = async () => {
	try {
		await execa('git', ['ls-remote', 'origin', 'HEAD']);
	} catch (error) {
		throw new Error(error.stderr.replace('fatal:', 'Git fatal error:'));
	}
};

exports.fetch = () => execa('git', ['fetch']);

exports.tagExistsOnRemote = async tagName => {
	try {
		const {stdout: revInfo} = await execa('git', ['rev-parse', '--quiet', '--verify', `refs/tags/${tagName}`]);

		if (revInfo) {
			return true;
		}

		return false;
	} catch (error) {
		// Command fails with code 1 and no output if the tag does not exist, even though `--quiet` is provided
		// https://github.com/sindresorhus/np/pull/73#discussion_r72385685
		if (error.stdout === '' && error.stderr === '') {
			return false;
		}

		throw error;
	}
};

exports.verifyTagDoesNotExistOnRemote = async tagName => {
	if (await exports.tagExistsOnRemote(tagName)) {
		throw new Error(`Git tag \`${tagName}\` already exists.`);
	}
};

exports.commitLogFromRevision = revision => execa.stdout('git', ['log', '--format=%s %h', `${revision}..HEAD`]);

exports.push = () => execa('git', ['push', '--follow-tags']);
