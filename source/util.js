'use strict';
const readPkgUp = require('read-pkg-up');
const issueRegex = require('issue-regex');
const terminalLink = require('terminal-link');
const execa = require('execa');
const pMemoize = require('p-memoize');
const {default: ow} = require('ow');
const pkgDir = require('pkg-dir');
const chalk = require('chalk');
const gitUtil = require('./git-util');
const npmUtil = require('./npm/util');

exports.readPkg = packagePath => {
	packagePath = packagePath ? pkgDir.sync(packagePath) : pkgDir.sync();

	if (!packagePath) {
		throw new Error('No `package.json` found. Make sure the current directory is a valid package.');
	}

	const {packageJson, path} = readPkgUp.sync({
		cwd: packagePath
	});

	return {pkg: packageJson, pkgPath: path};
};

exports.linkifyIssues = (url, message) => {
	if (!(url && terminalLink.isSupported)) {
		return message;
	}

	return message.replace(issueRegex(), issue => {
		const issuePart = issue.replace('#', '/issues/');

		if (issue.startsWith('#')) {
			return terminalLink(issue, `${url}${issuePart}`);
		}

		return terminalLink(issue, `https://github.com/${issuePart}`);
	});
};

exports.linkifyCommit = (url, commit) => {
	if (!(url && terminalLink.isSupported)) {
		return commit;
	}

	return terminalLink(commit, `${url}/commit/${commit}`);
};

exports.linkifyCommitRange = (url, commitRange) => {
	if (!(url && terminalLink.isSupported)) {
		return commitRange;
	}

	return terminalLink(commitRange, `${url}/compare/${commitRange}`);
};

exports.getTagVersionPrefix = pMemoize(async options => {
	ow(options, ow.object.hasKeys('yarn'));

	try {
		if (options.yarn) {
			const {stdout} = await execa('yarn', ['config', 'get', 'version-tag-prefix']);
			return stdout;
		}

		const {stdout} = await execa('npm', ['config', 'get', 'tag-version-prefix']);
		return stdout;
	} catch {
		return 'v';
	}
});

exports.joinList = list => chalk.reset(list.map(item => `- ${item}`).join('\n'));

exports.getNewFiles = async pkg => {
	const listNewFiles = await gitUtil.newFilesSinceLastRelease();
	return {unpublished: await npmUtil.getNewAndUnpublishedFiles(pkg, listNewFiles), firstTime: await npmUtil.getFirstTimePublishedFiles(pkg, listNewFiles)};
};

exports.getNewDependencies = async (newPkg, pkgPath) => {
	let oldPkg = await gitUtil.readFileFromLastRelease(pkgPath);
	oldPkg = JSON.parse(oldPkg);

	const newDependencies = [];

	for (const dependency of Object.keys(newPkg.dependencies)) {
		if (!oldPkg.dependencies[dependency]) {
			newDependencies.push(dependency);
		}
	}

	return newDependencies;
};

exports.getPreReleasePrefix = pMemoize(async options => {
	ow(options, ow.object.hasKeys('yarn'));

	try {
		if (options.yarn) {
			const {stdout} = await execa('yarn', ['config', 'get', 'preId']);
			if (stdout !== 'undefined') {
				return stdout;
			}

			return '';
		}

		const {stdout} = await execa('npm', ['config', 'get', 'preId']);
		if (stdout !== 'undefined') {
			return stdout;
		}

		return '';
	} catch {
		return '';
	}
});
