'use strict';
const git = require('./git-util');

module.exports = async () => {
	const latest = await git.latestTagOrFirstCommit();
	const log = await git.commitLogFromRevision(latest);

	if (!log) {
		return [];
	}

	return log.split('\n')
		.map(commit => {
			const splitIndex = commit.lastIndexOf(' ');
			return {
				message: commit.slice(0, splitIndex),
				id: commit.slice(splitIndex + 1)
			};
		});
};
