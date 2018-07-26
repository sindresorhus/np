'use strict';
const execa = require('execa');
const ghGot = require('gh-got');
const hostedGitInfo = require('hosted-git-info');
const pWaitFor = require('p-wait-for');
const util = require('./util');

const THIRTY_SECONDS = 30 * 1000;

module.exports = () => {
	return execa.stdout('git', ['rev-parse', 'HEAD'])
		.then(commit => {
			const pkg = util.readPkg();
			const {user, project} = hostedGitInfo.fromUrl(pkg.repository.url);

			const checkState = () => ghGot(`repos/${user}/${project}/commits/${commit}/status`)
				.then(response => {
					const {state} = response.body;

					if (state === 'failure') {
						throw new Error('Some checks were not successful');
					} else if (state === 'pending') {
						return false;
					}

					return true;
				});

			return pWaitFor(checkState, THIRTY_SECONDS);
		});
};
