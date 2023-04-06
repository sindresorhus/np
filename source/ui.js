import inquirer from 'inquirer';
import chalk from 'chalk';
import githubUrlFromGit from 'github-url-from-git';
import {htmlEscape} from 'escape-goat';
import isScoped from 'is-scoped';
import isInteractive from 'is-interactive';
import * as util from './util.js';
import * as git from './git-util.js';
import * as npm from './npm/util.js';
import Version from './version.js';
import prettyVersionDiff from './pretty-version-diff.js';

const printCommitLog = async (repoUrl, registryUrl, fromLatestTag, releaseBranch) => {
	const revision = fromLatestTag ? await git.latestTagOrFirstCommit() : await git.previousTagOrFirstCommit();
	if (!revision) {
		throw new Error('The package has not been published yet.');
	}

	const log = await git.commitLogFromRevision(revision);

	if (!log) {
		return {
			hasCommits: false,
			hasUnreleasedCommits: false,
			releaseNotes() {},
		};
	}

	let hasUnreleasedCommits = false;
	let commitRangeText = `${revision}...${releaseBranch}`;

	let commits = log.split('\n')
		.map(commit => {
			const splitIndex = commit.lastIndexOf(' ');
			return {
				message: commit.slice(0, splitIndex),
				id: commit.slice(splitIndex + 1),
			};
		});

	if (!fromLatestTag) {
		const latestTag = await git.latestTag();

		// Version bump commit created by np, following the semver specification.
		const versionBumpCommitName = latestTag.match(/v\d+\.\d+\.\d+/) && latestTag.slice(1); // Name v1.0.1 becomes 1.0.1
		const versionBumpCommitIndex = commits.findIndex(commit => commit.message === versionBumpCommitName);

		if (versionBumpCommitIndex > 0) {
			commitRangeText = `${revision}...${latestTag}`;
			hasUnreleasedCommits = true;
		}

		if (await git.isHeadDetached()) {
			commitRangeText = `${revision}...${latestTag}`;
		}

		// Get rid of unreleased commits and of the version bump commit.
		commits = commits.slice(versionBumpCommitIndex + 1);
	}

	const history = commits.map(commit => {
		const commitMessage = util.linkifyIssues(repoUrl, commit.message);
		const commitId = util.linkifyCommit(repoUrl, commit.id);
		return `- ${commitMessage}  ${commitId}`;
	}).join('\n');

	const releaseNotes = nextTag => commits.map(commit =>
		`- ${htmlEscape(commit.message)}  ${commit.id}`,
	).join('\n') + `\n\n${repoUrl}/compare/${revision}...${nextTag}`;

	const commitRange = util.linkifyCommitRange(repoUrl, commitRangeText);
	console.log(`${chalk.bold('Commits:')}\n${history}\n\n${chalk.bold('Commit Range:')}\n${commitRange}\n\n${chalk.bold('Registry:')}\n${registryUrl}\n`);

	return {
		hasCommits: true,
		hasUnreleasedCommits,
		releaseNotes,
	};
};

const checkNewFilesAndDependencies = async (pkg, rootDir) => {
	const newFiles = await util.getNewFiles(rootDir);
	const newDependencies = await util.getNewDependencies(pkg, rootDir);

	const noNewUnpublishedFiles = !newFiles.unpublished || newFiles.unpublished.length === 0;
	const noNewFirstTimeFiles = !newFiles.firstTime || newFiles.firstTime.length === 0;
	const noNewFiles = noNewUnpublishedFiles && noNewFirstTimeFiles;

	const noNewDependencies = !newDependencies || newDependencies.length === 0;

	if (noNewFiles && noNewDependencies) {
		return true;
	}

	const messages = [];
	if (newFiles.unpublished.length > 0) {
		messages.push(`The following new files will not be part of your published package:\n${util.joinList(newFiles.unpublished)}`);
	}

	if (newFiles.firstTime.length > 0) {
		messages.push(`The following new files will be published for the first time:\n${util.joinList(newFiles.firstTime)}`);
	}

	if (newDependencies.length > 0) {
		messages.push(`The following new dependencies will be part of your published package:\n${util.joinList(newDependencies)}`);
	}

	if (!isInteractive()) {
		console.log(messages.join('\n'));
		return true;
	}

	const answers = await inquirer.prompt([{
		type: 'confirm',
		name: 'confirm',
		message: `${messages.join('\n')}\nContinue?`,
		default: false,
	}]);

	return answers.confirm;
};

// eslint-disable-next-line complexity
const ui = async (options, {pkg, rootDir}) => {
	const oldVersion = pkg.version;
	const extraBaseUrls = ['gitlab.com'];
	const repoUrl = pkg.repository && githubUrlFromGit(pkg.repository.url, {extraBaseUrls});
	const pkgManager = options.yarn ? 'yarn' : 'npm';
	const registryUrl = await npm.getRegistryUrl(pkgManager, pkg);
	const releaseBranch = options.branch;

	if (options.runPublish) {
		npm.checkIgnoreStrategy(pkg, rootDir);

		const answerIgnoredFiles = await checkNewFilesAndDependencies(pkg, rootDir);
		if (!answerIgnoredFiles) {
			return {
				...options,
				confirm: answerIgnoredFiles,
			};
		}
	}

	if (options.releaseDraftOnly) {
		console.log(`\nCreate a release draft on GitHub for ${chalk.bold.magenta(pkg.name)} ${chalk.dim(`(current: ${oldVersion})`)}\n`);
	} else {
		const newVersion = options.version ? Version.getAndValidateNewVersionFrom(options.version, oldVersion) : undefined;
		const versionText = chalk.dim(`(current: ${oldVersion}${newVersion ? `, next: ${prettyVersionDiff(oldVersion, newVersion)}` : ''}${chalk.dim(')')}`);

		console.log(`\nPublish a new version of ${chalk.bold.magenta(pkg.name)} ${versionText}\n`);
	}

	const useLatestTag = !options.releaseDraftOnly;
	const {hasCommits, hasUnreleasedCommits, releaseNotes} = await printCommitLog(repoUrl, registryUrl, useLatestTag, releaseBranch);

	if (hasUnreleasedCommits && options.releaseDraftOnly) {
		const answers = await inquirer.prompt({
			confirm: {
				type: 'confirm',
				message: 'Unreleased commits found. They won\'t be included in the release draft. Continue?',
				default: false,
			},
		});

		if (!answers.confirm) {
			return {
				...options,
				...answers,
			};
		}
	}

	if (options.version) {
		return {
			...options,
			confirm: true,
			repoUrl,
			releaseNotes,
		};
	}

	if (!hasCommits) {
		const answers = await inquirer.prompt({
			confirm: {
				type: 'confirm',
				message: 'No commits found since previous release, continue?',
				default: false,
			},
		});

		if (!answers.confirm) {
			return {
				...options,
				...answers,
			};
		}
	}

	if (options.availability.isUnknown) {
		const answers = await inquirer.prompt({
			confirm: {
				type: 'confirm',
				when: isScoped(pkg.name) && options.runPublish,
				message: `Failed to check availability of scoped repo name ${chalk.bold.magenta(pkg.name)}. Do you want to try and publish it anyway?`,
				default: false,
			},
		});

		if (!answers.confirm) {
			return {
				...options,
				...answers,
			};
		}
	}

	const answers = await inquirer.prompt({
		version: {
			type: 'list',
			message: 'Select semver increment or specify new version',
			pageSize: Version.SEMVER_INCREMENTS.length + 2,
			choices: [...Version.SEMVER_INCREMENTS
				.map(inc => ({
					name: `${inc} 	${prettyVersionDiff(oldVersion, inc)}`,
					value: inc,
				})),
			new inquirer.Separator(),
			{
				name: 'Other (specify)',
				value: null,
			}],
			filter: input => Version.isValidInput(input) ? new Version(oldVersion).getNewVersionFrom(input) : input,
		},
		customVersion: {
			type: 'input',
			message: 'Version',
			when: answers => !answers.version,
			filter: input => Version.isValidInput(input) ? new Version(pkg.version).getNewVersionFrom(input) : input,
			validate(input) {
				if (!Version.isValidInput(input)) {
					return 'Please specify a valid semver, for example, `1.2.3`. See https://semver.org';
				}

				if (new Version(oldVersion).isLowerThanOrEqualTo(input)) {
					return `Version must be greater than ${oldVersion}`;
				}

				return true;
			},
		},
		tag: {
			type: 'list',
			message: 'How should this pre-release version be tagged in npm?',
			when: answers => options.runPublish && (Version.isPrereleaseOrIncrement(answers.customVersion) || Version.isPrereleaseOrIncrement(answers.version)) && !options.tag,
			async choices() {
				const existingPrereleaseTags = await npm.prereleaseTags(pkg.name);

				return [
					...existingPrereleaseTags,
					new inquirer.Separator(),
					{
						name: 'Other (specify)',
						value: null,
					},
				];
			},
		},
		customTag: {
			type: 'input',
			message: 'Tag',
			when: answers => options.runPublish && (Version.isPrereleaseOrIncrement(answers.customVersion) || Version.isPrereleaseOrIncrement(answers.version)) && !options.tag && !answers.tag,
			validate(input) {
				if (input.length === 0) {
					return 'Please specify a tag, for example, `next`.';
				}

				if (input.toLowerCase() === 'latest') {
					return 'It\'s not possible to publish pre-releases under the `latest` tag. Please specify something else, for example, `next`.';
				}

				return true;
			},
		},
		publishScoped: {
			type: 'confirm',
			when: isScoped(pkg.name) && options.availability.isAvailable && !options.availability.isUnknown && options.runPublish && (pkg.publishConfig && pkg.publishConfig.access !== 'restricted') && !npm.isExternalRegistry(pkg),
			message: `This scoped repo ${chalk.bold.magenta(pkg.name)} hasn't been published. Do you want to publish it publicly?`,
			default: false,
		},
	});

	return {
		...options,
		version: answers.version || answers.customVersion || options.version,
		tag: answers.tag || answers.customTag || options.tag,
		publishScoped: answers.publishScoped,
		confirm: true,
		repoUrl,
		releaseNotes,
	};
};

export default ui;
