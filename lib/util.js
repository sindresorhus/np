'use strict';
const readPkgUp = require('read-pkg-up');
const issueRegex = require('issue-regex');
const terminalLink = require('terminal-link');
const execa = require('execa');
const pMemoize = require('p-memoize');
const ow = require('ow');

exports.readPkg = () => {
	const {pkg} = readPkgUp.sync();

	if (!pkg) {
		throw new Error('No package.json found. Make sure you\'re in the correct project.');
	}

	return pkg;
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
			return await execa.stdout('yarn', ['config', 'get', 'version-tag-prefix']);
		}

		return await execa.stdout('npm', ['config', 'get', 'tag-version-prefix']);
	} catch (_) {
		return 'v';
	}
});
