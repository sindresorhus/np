'use strict';
const Listr = require('listr');
const {currentBranch, isWorkingTreeClean, remoteHistoryClean} = require('./git-util');

module.exports = options => {
	const tasks = [
		{
			title: 'Check current branch',
			task: async () => {
				const branch = await currentBranch();
				if (branch !== 'master') {
					throw new Error('Not on `master` branch. Use --any-branch to publish anyway.');
				}
			}
		},
		{
			title: 'Check local working tree',
			task: async () => {
				if (!(await isWorkingTreeClean())) {
					throw new Error('Unclean working tree. Commit or stash changes first.');
				}
			}
		},
		{
			title: 'Check remote history',
			task: async () => {
				if (!(await remoteHistoryClean())) {
					throw new Error('Remote history differs. Please pull changes.');
				}
			}
		}
	];

	if (options.anyBranch) {
		tasks.shift();
	}

	return new Listr(tasks);
};
