'use strict';
const readPkgUp = require('read-pkg-up');
const issueRegex = require('issue-regex');
const terminalLink = require('terminal-link');

exports.readPkg = () => {
	const {pkg} = readPkgUp.sync();

	if (!pkg) {
		throw new Error(`No package.json found. Make sure you're in the correct project.`);
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
