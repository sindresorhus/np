'use strict';
const Listr = require('listr');
const git = require('./git-util');

module.exports = () => {
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
		}
	];

	return new Listr(tasks);
};
