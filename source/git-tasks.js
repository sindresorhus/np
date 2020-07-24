'use strict';
const Listr = require('listr');
const git = require('./git-util');

module.exports = options => {
	const tasks = [
		{
			title: 'Check current branch',
			task: () => git.verifyCurrentBranchIsReleaseBranch(options.branch)
		},
		{
			title: 'Check local working tree',
			task: () => git.verifyWorkingTreeIsClean()
		},
		{
			title: 'Check remote history',
			task: () => git.verifyRemoteHistoryIsClean()
		}
	];

	if (options.anyBranch) {
		tasks.shift();
	}

	return new Listr(tasks);
};
