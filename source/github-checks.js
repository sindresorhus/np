'use strict';
const chalk = require('chalk');
const delay = require('delay');
const ghGot = require('gh-got');
const pTimeout = require('p-timeout');
const pWaitFor = require('p-wait-for');
const terminalLink = require('terminal-link');
const git = require('./git-util');
const util = require('./util');

const THIRTY_SECONDS = 1000 * 30;
const THIRTY_MINUTES = 1000 * 60 * 30;

module.exports = async (task, pkg, options) => {
	const {title} = task;

	if (await git.hasUnpushedCommits()) {
		if (options.preview) {
			return task.skip('[Preview] Will not ensure checks have passed because there are unpushed commits.');
		}

		await git.push();

		// It might take a bit for the status checks to be created.
		// Even if, it probably takes at least a few seconds for them to pass.
		task.title = `${title} ${chalk.yellow('(waiting for checks to start…)')}`;
		await delay(THIRTY_SECONDS);
	}

	const latestCommit = await git.latestCommit();
	const {user, project} = util.hostedGitInfo(pkg.repository.url);

	const checkState = async () => {
		try {
			const response = await ghGot(`repos/${user}/${project}/commits/${latestCommit}/status`);
			const {state, statuses, total_count: totalCount} = response.body;

			if (totalCount === 0) {
				task.skip('No status checks found');
				return true;
			}

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
			} else if (state === 'success') {
				task.title = title;
				return true;
			} else {
				throw new Error(`Unknown state: ${state}`);
			}
		} catch (error) {
			const {rateLimit} = error;

			if (rateLimit && rateLimit.remaining === 0) {
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
