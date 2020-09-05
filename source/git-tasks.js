'use strict';
const Listr = require('listr');
const git = require('./git-util');

module.exports = (options) => {
	const tasks = [
		{
			title: 'Check git remote',
			task: async () => git.verifyRemoteIsValid()
		},
		{
			title: 'Check local working tree',
			task: () => git.verifyWorkingTreeIsClean()
		},
		{
			title: 'Check remote history',
			task: () => git.verifyRemoteHistoryIsClean()
		},
		{
			title: 'Check current branch',
			task: () => git.verifyCurrentBranchIsReleaseBranch(options.branch)
		},
		{
			title: 'Check git version',
			task: async () => git.verifyRecentGitVersion()
		}
	];

	if (options.anyBranch) {
		tasks.pop()
	}

	return new Listr(tasks);
};
