'use strict';
const execa = require('execa');
const escapeStringRegexp = require('escape-string-regexp');
const {verifyRequirementSatisfied} = require('./version');

exports.latestTag = async () => {
	const {stdout} = await execa('git', ['describe', '--abbrev=0', '--tags']);
	return stdout;
};

const firstCommit = async () => {
	const {stdout} = await execa('git', ['rev-list', '--max-parents=0', 'HEAD']);
	return stdout;
};

exports.latestTagOrFirstCommit = async () => {
	let latest;
	try {
		// In case a previous tag exists, we use it to compare the current repo status to.
		latest = await exports.latestTag();
	} catch (_) {
		// Otherwise, we fallback to using the first commit for comparison.
		latest = await firstCommit();
	}

	return latest;
};

exports.hasUpstream = async () => {
	const escapedCurrentBranch = escapeStringRegexp(await exports.currentBranch());
	const {stdout} = await execa('git', ['status', '--short', '--branch', '--porcelain']);

	return new RegExp(String.raw`^## ${escapedCurrentBranch}\.\.\..+\/${escapedCurrentBranch}`).test(stdout);
};

exports.currentBranch = async () => {
	const {stdout} = await execa('git', ['symbolic-ref', '--short', 'HEAD']);
	return stdout;
};

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
		const {stdout} = await execa('git', ['rev-list', '--count', '--left-only', '@{u}...HEAD']);
		history = stdout;
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

exports.fetch = async () => {
	await execa('git', ['fetch']);
};

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

exports.commitLogFromRevision = async revision => {
	const {stdout} = await execa('git', ['log', '--format=%s %h', `${revision}..HEAD`]);
	return stdout;
};

exports.push = async () => {
	await execa('git', ['push', '--follow-tags']);
};

exports.deleteTag = async tagName => {
	await execa('git', ['tag', '--delete', tagName]);
};

exports.removeLastCommit = async () => {
	await execa('git', ['reset', '--hard', 'HEAD~1']);
};

const gitVersion = async () => {
	const {stdout} = await execa('git', ['version']);
	return stdout.match(/git version (\d+\.\d+\.\d+).*/)[1];
};

exports.verifyRecentGitVersion = async () => {
	const installedVersion = await gitVersion();

	verifyRequirementSatisfied('git', installedVersion);
};
