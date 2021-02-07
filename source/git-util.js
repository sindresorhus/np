'use strict';
const execa = require('execa');
const escapeStringRegexp = require('escape-string-regexp');
const ignoreWalker = require('ignore-walk');
const pkgDir = require('pkg-dir');
const {verifyRequirementSatisfied} = require('./version');

exports.latestTag = async () => {
	const {stdout} = await execa('git', ['describe', '--abbrev=0', '--tags']);
	return stdout;
};

exports.newFilesSinceLastRelease = async () => {
	try {
		const {stdout} = await execa('git', ['diff', '--name-only', '--diff-filter=A', await this.latestTag(), 'HEAD']);
		if (stdout.trim().length === 0) {
			return [];
		}

		const result = stdout.trim().split('\n').map(row => row.trim());
		return result;
	} catch {
		// Get all files under version control
		return ignoreWalker({
			path: pkgDir.sync(),
			ignoreFiles: ['.gitignore']
		});
	}
};

const firstCommit = async () => {
	const {stdout} = await execa('git', ['rev-list', '--max-parents=0', 'HEAD']);
	return stdout;
};

exports.previousTagOrFirstCommit = async () => {
	const tags = await exports.tagList();

	if (tags.length === 0) {
		return;
	}

	if (tags.length === 1) {
		return firstCommit();
	}

	try {
		// Return the tag before the latest one.
		const latest = await exports.latestTag();
		const index = tags.indexOf(latest);
		return tags[index - 1];
	} catch {
		// Fallback to the first commit.
		return firstCommit();
	}
};

exports.latestTagOrFirstCommit = async () => {
	let latest;
	try {
		// In case a previous tag exists, we use it to compare the current repo status to.
		latest = await exports.latestTag();
	} catch {
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

exports.verifyCurrentBranchIsReleaseBranch = async releaseBranch => {
	const currentBranch = await exports.currentBranch();
	if (currentBranch !== releaseBranch) {
		throw new Error(`Not on \`${releaseBranch}\` branch. Use --any-branch to publish anyway, or set a different release branch using --branch.`);
	}
};

exports.tagList = async () => {
	// Returns the list of tags, sorted by creation date in ascending order.
	const {stdout} = await execa('git', ['tag', '--sort=creatordate']);
	return stdout.split('\n');
};

exports.isHeadDetached = async () => {
	try {
		// Command will fail with code 1 if the HEAD is detached.
		await execa('git', ['symbolic-ref', '--quiet', 'HEAD']);
		return false;
	} catch {
		return true;
	}
};

exports.isWorkingTreeClean = async () => {
	try {
		const {stdout: status} = await execa('git', ['status', '--porcelain']);
		if (status !== '') {
			return false;
		}

		return true;
	} catch {
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
	} catch {}

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

async function hasLocalBranch(branch) {
	try {
		await execa('git', [
			'show-ref',
			'--verify',
			'--quiet',
			`refs/heads/${branch}`
		]);
		return true;
	} catch {
		return false;
	}
}

exports.defaultBranch = async () => {
	for (const branch of ['main', 'master', 'gh-pages']) {
		// eslint-disable-next-line no-await-in-loop
		if (await hasLocalBranch(branch)) {
			return branch;
		}
	}

	throw new Error(
		'Could not infer the default Git branch. Please specify one with the --branch flag or with a np config.'
	);
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

exports.pushGraceful = async remoteIsOnGitHub => {
	try {
		await exports.push();
	} catch (error) {
		if (remoteIsOnGitHub && error.stderr && error.stderr.includes('GH006')) {
			// Try to push tags only, when commits can't be pushed due to branch protection
			await execa('git', ['push', '--tags']);
			return {pushed: 'tags', reason: 'Branch protection: np can`t push the commits. Push them manually.'};
		}

		throw error;
	}
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
	const match = /git version (?<version>\d+\.\d+\.\d+).*/.exec(stdout);
	return match && match.groups.version;
};

exports.verifyRecentGitVersion = async () => {
	const installedVersion = await gitVersion();

	verifyRequirementSatisfied('git', installedVersion);
};

exports.checkIfFileGitIgnored = async pathToFile => {
	try {
		const {stdout} = await execa('git', ['check-ignore', pathToFile]);
		return Boolean(stdout);
	} catch (error) {
		// If file is not ignored, `git check-ignore` throws an empty error and exits.
		// Check that and return false so as not to throw an unwanted error.
		if (error.stdout === '' && error.stderr === '') {
			return false;
		}

		throw error;
	}
};
