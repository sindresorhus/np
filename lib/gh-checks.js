'use strict';
const execa = require('execa');
const ghGot = require('gh-got');
const hostedGitInfo = require('hosted-git-info');
const pWaitFor = require('p-wait-for');
const terminalLink = require('terminal-link');
const util = require('./util');

const THIRTY_SECONDS = 30 * 1000;

module.exports = () => {
	return execa.stdout('git', ['rev-parse', 'HEAD'])
		.then(commit => {
			const pkg = util.readPkg();
			const {user, project} = hostedGitInfo.fromUrl(pkg.repository.url);

			const checkState = () => ghGot(`repos/${user}/${project}/commits/${commit}/status`)
				.then(response => {
					const {state, statuses} = response.body;

					if (state === 'failure') {
						if (statuses.length === 1) {
							throw new Error('Failure: ' + terminalLink(statuses[0].description, statuses[0].target_url));
						} else {
							const failures = statuses.filter(status => status.state === 'error' || status.state === 'failure');
							const contexts = failures.map(status => terminalLink(status.context, status.target_url));

							if (failures.length === statuses.length) {
								throw new Error('All checks have failed: ' + contexts.join(', '));
							} else {
								throw new Error('Some checks were not successful: ' + contexts.join(', '));
							}
						}
					} else if (state === 'pending') {
						return false;
					}

					return true;
				});

			return pWaitFor(checkState, THIRTY_SECONDS);
		});
};
