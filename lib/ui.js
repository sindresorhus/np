'use strict';
const execa = require('execa');
const inquirer = require('inquirer');
const chalk = require('chalk');
const githubUrlFromGit = require('github-url-from-git');
const isScoped = require('is-scoped');
const util = require('./util');
const {latestTagOrFirstCommit} = require('./git-util');
const version = require('./version');

const prettyVersionDiff = (oldVersion, inc) => {
	const newVersion = version.getNewVersion(oldVersion, inc).split('.');
	oldVersion = oldVersion.split('.');
	let firstVersionChange = false;
	const output = [];

	for (let i = 0; i < newVersion.length; i++) {
		if ((newVersion[i] !== oldVersion[i] && !firstVersionChange)) {
			output.push(`${chalk.dim.cyan(newVersion[i])}`);
			firstVersionChange = true;
		} else if (newVersion[i].indexOf('-') >= 1) {
			let preVersion = [];
			preVersion = newVersion[i].split('-');
			output.push(`${chalk.dim.cyan(`${preVersion[0]}-${preVersion[1]}`)}`);
		} else {
			output.push(chalk.reset.dim(newVersion[i]));
		}
	}

	return output.join(chalk.reset.dim('.'));
};

const printCommitLog = async repoUrl => {
	const latest = await latestTagOrFirstCommit();
	const {stdout: log} = await execa('git', ['log', '--format=%s %h', `${latest}..HEAD`]);

	if (!log) {
		return {
			hasCommits: false,
			changeLog: null
		};
	}

	const history = log.split('\n')
		.map(commit => {
			const splitIndex = commit.lastIndexOf(' ');
			const commitMessage = util.linkifyIssues(repoUrl, commit.slice(0, splitIndex));
			const commitId = util.linkifyCommit(repoUrl, commit.slice(splitIndex + 1));
			return `- ${commitMessage}  ${commitId}`;
		})
		.join('\n');

	const changeLog = nextTag => 'Changes: \n' +
		log.split('\n')
			.map(commit => {
				const splitIndex = commit.lastIndexOf(' ');
				const commitMessage = util.linkifyIssues(repoUrl, commit.slice(0, splitIndex));
				const commitId = `${repoUrl}/commit/${commit.slice(splitIndex + 1)}`;
				return `- ${commitMessage}  ${commitId}`;
			})
			.join('\n') +
		`\n\n${repoUrl}/compare/${latestTag}..${nextTag}`;

	const commitRange = util.linkifyCommitRange(repoUrl, `${latestTag}...master`);

	console.log(`${chalk.bold('Commits:')}\n${history}\n\n${chalk.bold('Commit Range:')}\n${commitRange}\n`);

	return {
		hasCommits: true,
		changeLog
	};
};

module.exports = async (options, pkg) => {
	const oldVersion = pkg.version;
	const extraBaseUrls = ['gitlab.com'];
	const repoUrl = pkg.repository && githubUrlFromGit(pkg.repository.url, {extraBaseUrls});

	console.log(`\nPublish a new version of ${chalk.bold.magenta(pkg.name)} ${chalk.dim(`(current: ${oldVersion})`)}\n`);

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
			filter: input => version.isValidVersionInput(input) ? version.getNewVersion(oldVersion, input) : input
		},
		{
			type: 'input',
			name: 'version',
			message: 'Version',
			when: answers => !answers.version,
			filter: input => version.isValidVersionInput(input) ? version.getNewVersion(pkg.version, input) : input,
			validate: input => {
				if (!version.isValidVersionInput(input)) {
					return 'Please specify a valid semver, for example, `1.2.3`. See http://semver.org';
				}

				if (!version.isVersionGreater(oldVersion, input)) {
					return `Version must be greater than ${oldVersion}`;
				}

				return true;
			}
		},
		{
			type: 'list',
			name: 'tag',
			message: 'How should this pre-release version be tagged in npm?',
			when: answers => !pkg.private && version.isPrereleaseVersion(answers.version) && !options.tag,
			choices: async () => {
				const {stdout} = await execa('npm', ['view', '--json', pkg.name, 'dist-tags']);

				const existingPrereleaseTags = Object.keys(JSON.parse(stdout))
					.filter(tag => tag !== 'latest');

				if (existingPrereleaseTags.length === 0) {
					existingPrereleaseTags.push('next');
				}

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
			when: answers => !pkg.private && version.isPrereleaseVersion(answers.version) && !options.tag && !answers.tag,
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
			name: 'confirm',
			message: answers => {
				const tag = answers.tag || options.tag;
				const tagPart = tag ? ` and tag this release in npm as ${tag}` : '';

				return `Will bump from ${chalk.cyan(oldVersion)} to ${chalk.cyan(answers.version + tagPart)}. Continue?`;
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

	const {hasCommits, changeLog} = await printCommitLog(repoUrl);

	if (!hasCommits) {
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

	const answers = await inquirer.prompt(prompts);

	return {
		...options,
		...answers,
		repoUrl,
		changeLog
	};
};
