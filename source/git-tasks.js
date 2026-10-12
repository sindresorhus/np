import * as git from './git-util.js';
import {TaskList} from './task-list/index.js';

const createGitTasks = options => {
	const tasks = [
		{
			title: 'Check current branch',
			run: () => git.verifyCurrentBranchIsReleaseBranch(options.branch),
		},
		{
			title: 'Check local working tree',
			run: () => git.verifyWorkingTreeIsClean(),
		},
		{
			title: 'Check remote history',
			run: () => git.verifyRemoteHistoryIsClean(),
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

export default function gitTasks(options) {
	return new TaskList(createGitTasks(options));
}
