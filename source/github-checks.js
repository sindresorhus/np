'use strict';
const chalk = require('chalk');
const execa = require('execa');
const ghGot = require('gh-got');
const hostedGitInfo = require('hosted-git-info');
const pTimeout = require('p-timeout');
const pWaitFor = require('p-wait-for');
const terminalLink = require('terminal-link');
const git = require('./git-util');
const util = require('./util');

const THIRTY_SECONDS = 1000 * 30;
const THIRTY_MINUTES = 1000 * 60 * 30;

module.exports = async task => {
	if (await git.hasUnpushedCommits()) {
		await git.push();
	}

	const latestCommit = execa.stdout('git', ['rev-parse', 'HEAD']);
	const {title} = task;
	const pkg = util.readPkg();
	const {user, project} = hostedGitInfo.fromUrl(pkg.repository.url);

	const checkState = async () => {
		try {
			const response = await ghGot(`repos/${user}/${project}/commits/${latestCommit}/status`);
			const {state, statuses} = response.body;

			if (state === 'failure') {
				task.title = title;

				const failures = statuses.filter(status => status.state === 'error' || status.state === 'failure');
				const contexts = failures.map(status => terminalLink(status.context, status.target_url));

				if (failures.length === statuses.length) {
					throw new Error(`All checks have failed: ${contexts.join(', ')}`);
				} else {
					throw new Error(`Some checks were not successful: ${contexts.join(', ')}`);
				}
			} else if (state === 'pending') {
				task.title = `${title} ${chalk.yellow('(waiting for pending checks…)')}`;

				return false;
			}

			task.title = title;

			return true;
		} catch (error) {
			const {rateLimit} = error;

			if (rateLimit.remaining === 0) {
				throw new Error('Exceeded API rate limit');
			}

			throw error;
		}
	};

	return pTimeout(
		pWaitFor(checkState, {interval: THIRTY_SECONDS}),
		THIRTY_MINUTES,
		'Timed out after 30 minutes'
	);
};
