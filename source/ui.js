'use strict';
const inquirer = require('inquirer');
const chalk = require('chalk');
const isScoped = require('is-scoped');
const git = require('./git-util');
const {prereleaseTags} = require('./npm/util');
const version = require('./version');
const prettyVersionDiff = require('./pretty-version-diff');
const getCommits = require('./get-commits');
const printCommitLog = require('./print-commit-log');

const generateReleaseNotes = (commits, repoUrl, latest, nextTag) => {
	return [
		'## Highlights',
		'',
		...commits.map(commit => `- ${commit.message}  ${commit.id}`),
		'',
		'## All changes',
		'',
		`${repoUrl}/compare/${latest}...${nextTag}`
	].join('\n');
};

module.exports = async (options, pkg) => {
	const oldVersion = pkg.version;

	const prompts = [
		{
			type: 'list',
			name: 'version',
			message: 'Select semver increment or specify new version',
			pageSize: version.SEMVER_INCREMENTS.length + 2,
			choices: version.SEMVER_INCREMENTS
				.map(inc => ({
					name: `${inc} 	${prettyVersionDiff(oldVersion, inc)}`,
					value: inc
				}))
				.concat([
					new inquirer.Separator(),
					{
						name: 'Other (specify)',
						value: null
					}
				]),
			filter: input => version.isValidInput(input) ? version(oldVersion).getNewVersionFrom(input) : input
		},
		{
			type: 'input',
			name: 'version',
			message: 'Version',
			when: answers => !answers.version,
			filter: input => version.isValidInput(input) ? version(pkg.version).getNewVersionFrom(input) : input,
			validate: input => {
				if (!version.isValidInput(input)) {
					return 'Please specify a valid semver, for example, `1.2.3`. See http://semver.org';
				}

				if (version(oldVersion).isLowerThanOrEqualTo(input)) {
					return `Version must be greater than ${oldVersion}`;
				}

				return true;
			}
		},
		{
			type: 'list',
			name: 'tag',
			message: 'How should this pre-release version be tagged in npm?',
			when: answers => !pkg.private && version.isPrereleaseOrIncrement(answers.version) && !options.tag,
			choices: async () => {
				const existingPrereleaseTags = await prereleaseTags(pkg.name);

				return [
					...existingPrereleaseTags,
					new inquirer.Separator(),
					{
						name: 'Other (specify)',
						value: null
					}
				];
			}
		},
		{
			type: 'input',
			name: 'tag',
			message: 'Tag',
			when: answers => !pkg.private && version.isPrereleaseOrIncrement(answers.version) && !options.tag && !answers.tag,
			validate: input => {
				if (input.length === 0) {
					return 'Please specify a tag, for example, `next`.';
				}

				if (input.toLowerCase() === 'latest') {
					return 'It\'s not possible to publish pre-releases under the `latest` tag. Please specify something else, for example, `next`.';
				}

				return true;
			}
		},
		{
			type: 'confirm',
			name: 'publishScoped',
			when: isScoped(pkg.name) && !options.exists && options.publish && !pkg.private,
			message: `This scoped repo ${chalk.bold.magenta(pkg.name)} hasn't been published. Do you want to publish it publicly?`,
			default: false
		}
	];

	const commits = await getCommits();

	if (commits.length === 0) {
		const answers = await inquirer.prompt([{
			type: 'confirm',
			name: 'confirm',
			message: 'No commits found since previous release, continue?',
			default: false
		}]);

		if (!answers.confirm) {
			return {
				...options,
				...answers
			};
		}
	}

	await printCommitLog(commits, options.repoUrl);

	const latest = await git.latestTagOrFirstCommit();
	const releaseNotes = nextTag => generateReleaseNotes(commits, options.repoUrl, latest, nextTag);
	const answers = await inquirer.prompt(prompts);

	return {
		...options,
		...answers,
		confirm: true,
		releaseNotes
	};
};
