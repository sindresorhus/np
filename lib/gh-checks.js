'use strict';
const chalk = require('chalk');
const execa = require('execa');
const ghGot = require('gh-got');
const hostedGitInfo = require('hosted-git-info');
const pTimeout = require('p-timeout');
const pWaitFor = require('p-wait-for');
const terminalLink = require('terminal-link');
const util = require('./util');

const THIRTY_SECONDS = 1000 * 30;
const THIRTY_MINUTES = 1000 * 60 * 30;

module.exports = task => {
	return execa.stdout('git', ['cherry'])
		.then(stdout => {
			if (stdout === '') {
				return;
			}

			return execa('git', ['push']);
		})
		.then(() => execa.stdout('git', ['rev-parse', 'HEAD']))
		.then(commit => {
			const {title} = task;
			const pkg = util.readPkg();
			const {user, project} = hostedGitInfo.fromUrl(pkg.repository.url);

			const checkState = () => ghGot(`repos/${user}/${project}/commits/${commit}/status`)
				.then(response => {
					const {state, statuses} = response.body;

					if (state === 'failure') {
						task.title = title;

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
						task.title = `${title} ${chalk.yellow('(waiting for pending checks…)')}`;

						return false;
					}

					task.title = title;

					return true;
				})
				.catch(error => {
					if (error.name === 'GitHubError' && parseInt(error.headers['x-ratelimit-remaining'], 10) === 0) {
						throw new Error('Exceeded API rate limit');
					}

					throw error;
				});

			return pTimeout(
				pWaitFor(checkState, {interval: THIRTY_SECONDS}),
				THIRTY_MINUTES,
				'Timed out after 30 minutes'
			);
		});
};
