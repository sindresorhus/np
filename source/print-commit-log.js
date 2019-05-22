'use strict';
const chalk = require('chalk');
const git = require('./git-util');
const util = require('./util');

module.exports = async (commits, repoUrl) => {
	const latest = await git.latestTagOrFirstCommit();

	const history = commits.map(commit => {
		const commitMessage = util.linkifyIssues(repoUrl, commit.message);
		const commitId = util.linkifyCommit(repoUrl, commit.id);
		return `- ${commitMessage}  ${commitId}`;
	}).join('\n');

	const commitRange = util.linkifyCommitRange(repoUrl, `${latest}...master`);

	console.log(`${chalk.bold('Commits:')}\n${history}\n\n${chalk.bold('Commit Range:')}\n${commitRange}\n`);
};
