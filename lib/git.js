'use strict';
const execa = require('execa');
const Listr = require('listr');

module.exports = options => {
	const tasks = [
		{
			title: 'Check current branch',
			task: async () => {
				const {stdout: branch} = await execa('git', ['symbolic-ref', '--short', 'HEAD']);
				if (branch !== 'master') {
					throw new Error('Not on `master` branch. Use --any-branch to publish anyway.');
				}
			}
		},
		{
			title: 'Check local working tree',
			task: async () => {
				const {stdout: status} = await execa('git', ['status', '--porcelain']);
				if (status !== '') {
					throw new Error('Unclean working tree. Commit or stash changes first.');
				}
			}
		},
		{
			title: 'Check remote history',
			task: async () => {
				const {stdout} = await execa('git', ['rev-list', '--count', '--left-only', '@{u}...HEAD']);
				if (stdout !== '0') {
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
