import Listr from 'listr';
import * as git from './git-util.js';

const gitTasks = options => {
	const tasks = [
		{
			title: 'Check current branch',
			task: () => git.verifyCurrentBranchIsReleaseBranch(options.branch),
		},
		{
			title: 'Check local working tree',
			task: () => git.verifyWorkingTreeIsClean(),
		},
		{
			title: 'Check remote history',
			task: () => git.verifyRemoteHistoryIsClean(),
		},
	];

	if (options.anyBranch) {
		tasks.shift();
	}

	return new Listr(tasks);
};

export default gitTasks;
