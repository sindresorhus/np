'use strict';
const readPkgUp = require('read-pkg-up');
const issueRegex = require('issue-regex');
const hyperlinker = require('hyperlinker');
const supportsHyperlinks = require('supports-hyperlinks');

exports.readPkg = () => {
	const pkg = readPkgUp.sync().pkg;

	if (!pkg) {
		throw new Error(`No package.json found. Make sure you're in the correct project.`);
	}

	return pkg;
};

exports.linkifyIssues = (url, message) => {
	if (!url || !supportsHyperlinks.stdout) {
		return message;
	}

	return message.replace(issueRegex(), issue => {
		const issuePart = issue.replace('#', '/issues/');

		if (issue.startsWith('#')) {
			return hyperlinker(issue, `${url}${issuePart}`);
		}

		return hyperlinker(issue, `https://github.com/${issuePart}`);
	});
};

exports.linkifyCommit = (url, commit) => {
	if (!url || !supportsHyperlinks.stdout) {
		return commit;
	}

	return hyperlinker(commit, `${url}/commit/${commit}`);
};
