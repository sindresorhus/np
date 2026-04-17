import Listr from 'listr';
import * as git from './git-util.js';

const createGitTasks = options => {
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

	return tasks;
};

export const verifyGitTasks = async options => {
	if (!options.anyBranch) {
		await git.verifyCurrentBranchIsReleaseBranch(options.branch);
	}

	await git.verifyWorkingTreeIsClean();
	if (options.remote) {
		await git.verifyRemoteIsValid(options.remote);
	} else if (
		!(
			options.anyBranch
			&& await git.isHeadDetached()
		)
		&& await git.hasUpstream()
	) {
		await git.verifyRemoteIsValid(await git.getUpstreamRemote());
	}

	await git.verifyRemoteHistoryIsClean();
};

const gitTasks = options => new Listr(createGitTasks(options));

export default gitTasks;
