'use strict';
const inquirer = require('inquirer');
const chalk = require('chalk');
const githubUrlFromGit = require('github-url-from-git');
const {htmlEscape} = require('escape-goat');
const isScoped = require('is-scoped');
const isInteractive = require('is-interactive');
const util = require('./util');
const git = require('./git-util');
const {prereleaseTags, checkIgnoreStrategy, getRegistryUrl, isExternalRegistry} = require('./npm/util');
const version = require('./version');
const prettyVersionDiff = require('./pretty-version-diff');

const printCommitLog = async (repoUrl, registryUrl, fromLatestTag) => {
	const revision = fromLatestTag ? await git.latestTagOrFirstCommit() : await git.previousTagOrFirstCommit();
	if (!revision) {
		throw new Error('The package hasn\'t been published yet.');
	}

	const log = await git.commitLogFromRevision(revision);

	if (!log) {
		return {
			hasCommits: false,
			releaseNotes: () => {}
		};
	}

	let commits = log.split('\n')
		.map(commit => {
			const splitIndex = commit.lastIndexOf(' ');
			return {
				message: commit.slice(0, splitIndex),
				id: commit.slice(splitIndex + 1)
			};
		});

	if (!fromLatestTag) {
		const latestTag = await git.latestTag();
		const versionBumpCommitName = latestTag.slice(1); // Name v1.0.1 becomes 1.0.1
		const versionBumpCommitIndex = commits.findIndex(commit => commit.message === versionBumpCommitName);

		// Get rid of unreleased commits and of the version bump commit.
		commits = commits.slice(versionBumpCommitIndex + 1);
	}

	const history = commits.map(commit => {
		const commitMessage = util.linkifyIssues(repoUrl, commit.message);
		const commitId = util.linkifyCommit(repoUrl, commit.id);
		return `- ${commitMessage}  ${commitId}`;
	}).join('\n');

	const releaseNotes = nextTag => commits.map(commit =>
		`- ${htmlEscape(commit.message)}  ${commit.id}`
	).join('\n') + `\n\n${repoUrl}/compare/${revision}...${nextTag}`;

	const commitRange = util.linkifyCommitRange(repoUrl, `${revision}...master`);

	console.log(`${chalk.bold('Commits:')}\n${history}\n\n${chalk.bold('Commit Range:')}\n${commitRange}\n\n${chalk.bold('Registry:')}\n${registryUrl}\n`);

	return {
		hasCommits: true,
		releaseNotes
	};
};

const checkIgnoredFiles = async pkg => {
	const ignoredFiles = await util.getNewAndUnpublishedFiles(pkg);
	if (!ignoredFiles || ignoredFiles.length === 0) {
		return true;
	}

	const message = `The following new files are not already part of your published package:\n${chalk.reset(ignoredFiles.map(path => `- ${path}`).join('\n'))}`;
	if (!isInteractive()) {
		console.log(message);
		return true;
	}

	const answers = await inquirer.prompt([{
		type: 'confirm',
		name: 'confirm',
		message: `${message}\nContinue?`,
		default: false
	}]);

	return answers.confirm;
};

module.exports = async (options, pkg) => {
	const oldVersion = pkg.version;
	const extraBaseUrls = ['gitlab.com'];
	const repoUrl = pkg.repository && githubUrlFromGit(pkg.repository.url, {extraBaseUrls});
	const pkgManager = options.yarn ? 'yarn' : 'npm';
	const registryUrl = await getRegistryUrl(pkgManager, pkg);

	if (options.runPublish) {
		checkIgnoreStrategy(pkg);

		const answerIgnoredFiles = await checkIgnoredFiles(pkg);
		if (!answerIgnoredFiles) {
			return {
				...options,
				confirm: answerIgnoredFiles
			};
		}
	}

	if (options.releaseDraftOnly) {
		console.log(`\nCreate a release draft on GitHub for ${chalk.bold.magenta(pkg.name)} ${chalk.dim(`(current: ${oldVersion})`)}\n`);
	} else {
		console.log(`\nPublish a new version of ${chalk.bold.magenta(pkg.name)} ${chalk.dim(`(current: ${oldVersion})`)}\n`);
	}

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
			name: 'customVersion',
			message: 'Version',
			when: answers => !answers.version,
			filter: input => version.isValidInput(input) ? version(pkg.version).getNewVersionFrom(input) : input,
			validate: input => {
				if (!version.isValidInput(input)) {
					return 'Please specify a valid semver, for example, `1.2.3`. See https://semver.org';
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
			when: answers => options.runPublish && (version.isPrereleaseOrIncrement(answers.customVersion) || version.isPrereleaseOrIncrement(answers.version)) && !options.tag,
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
			name: 'customTag',
			message: 'Tag',
			when: answers => options.runPublish && (version.isPrereleaseOrIncrement(answers.customVersion) || version.isPrereleaseOrIncrement(answers.version)) && !options.tag && !answers.tag,
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
			when: isScoped(pkg.name) && options.availability.isAvailable && !options.availability.isUnknown && options.runPublish && (pkg.publishConfig && pkg.publishConfig.access !== 'restricted') && !isExternalRegistry(pkg),
			message: `This scoped repo ${chalk.bold.magenta(pkg.name)} hasn't been published. Do you want to publish it publicly?`,
			default: false
		}
	];

	const useLatestTag = !options.releaseDraftOnly;
	const {hasCommits, releaseNotes} = await printCommitLog(repoUrl, registryUrl, useLatestTag);

	if (options.version) {
		return {
			...options,
			confirm: true,
			repoUrl,
			releaseNotes
		};
	}

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

	if (options.availability.isUnknown) {
		const answers = await inquirer.prompt([{
			type: 'confirm',
			name: 'confirm',
			when: isScoped(pkg.name) && options.runPublish,
			message: `Failed to check availability of scoped repo name ${chalk.bold.magenta(pkg.name)}. Do you want to try and publish it anyway?`,
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
		version: answers.version || answers.customVersion || options.version,
		tag: answers.tag || answers.customTag || options.tag,
		confirm: true,
		repoUrl,
		releaseNotes
	};
};
