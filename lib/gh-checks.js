'use strict';
const execa = require('execa');
const ghGot = require('gh-got');
const hostedGitInfo = require('hosted-git-info');
const util = require('./util');

module.exports = () => {
	return execa.stdout('git', ['rev-parse', 'HEAD'])
		.then(commit => {
			const pkg = util.readPkg();
			const {user, project} = hostedGitInfo.fromUrl(pkg.repository.url);

			return ghGot(`repos/${user}/${project}/commits/${commit}/status`);
		})
		.then(response => {
			const {state} = response.body;

			if (state === 'failure') {
				throw new Error('Some checks were not successful');
			}
		});
};
