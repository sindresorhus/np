import inquirer from 'inquirer';
import chalk from 'chalk';
import githubUrlFromGit from 'github-url-from-git';
import {htmlEscape} from 'escape-goat';
import isScoped from 'is-scoped';
import isInteractive from 'is-interactive';
import {execa} from 'execa';
import Version, {SEMVER_INCREMENTS} from './version.js';
import * as util from './util.js';
import * as git from './git-util.js';
import * as npm from './npm/util.js';

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

const checkNewFilesAndDependencies = async (package_, rootDirectory) => {
	const newFiles = await util.getNewFiles(rootDirectory);
	const newDependencies = await util.getNewDependencies(package_, rootDirectory);

	const noNewUnpublishedFiles = !newFiles.unpublished || newFiles.unpublished.length === 0;
	const noNewFirstTimeFiles = !newFiles.firstTime || newFiles.firstTime.length === 0;
	const noNewFiles = noNewUnpublishedFiles && noNewFirstTimeFiles;

	const noNewDependencies = !newDependencies || newDependencies.length === 0;

	if (noNewFiles && noNewDependencies) {
		return true;
	}

	const messages = [];
	if (newFiles.unpublished.length > 0) {
		messages.push(`The following new files will not be part of your published package:\n${util.groupFilesInFolders(newFiles.unpublished)}\n\nIf you intended to publish them, add them to the \`files\` field in package.json.`);
	}

	if (newFiles.firstTime.length > 0) {
		messages.push(`The following new files will be published for the first time:\n${util.joinList(newFiles.firstTime)}\n\nPlease make sure only the intended files are listed.`);
	}

	if (newDependencies.length > 0) {
		messages.push(`The following new dependencies will be part of your published package:\n${util.joinList(newDependencies)}\n\nPlease make sure these new dependencies are intentional.`);
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

/**
@param {import('./cli-implementation.js').CLI['flags']} options
@param {{package_: import('read-pkg').NormalizedPackageJson; rootDirectory: string}} context
*/
const ui = async ({packageManager, ...options}, {package_, rootDirectory}) => { // eslint-disable-line complexity
	const oldVersion = package_.version;
	const extraBaseUrls = ['gitlab.com'];
	const repoUrl = package_.repository && githubUrlFromGit(package_.repository.url, {extraBaseUrls});

	const {stdout: registryUrl} = await execa(...packageManager.getRegistryCommand);
	const releaseBranch = options.branch;

	if (options.runPublish) {
		await npm.checkIgnoreStrategy(package_, rootDirectory);

		const answerIgnoredFiles = await checkNewFilesAndDependencies(package_, rootDirectory);
		if (!answerIgnoredFiles) {
			return {
				...options,
				confirm: answerIgnoredFiles,
			};
		}
	}

	if (options.releaseDraftOnly) {
		console.log(`\nCreate a release draft on GitHub for ${chalk.bold.magenta(package_.name)} ${chalk.dim(`(current: ${oldVersion})`)}\n`);
	} else {
		const versionText = options.version
			? chalk.dim(`(current: ${oldVersion}, next: ${new Version(oldVersion, options.version, {prereleasePrefix: await util.getPreReleasePrefix(packageManager)}).format()})`)
			: chalk.dim(`(current: ${oldVersion})`);

		console.log(`\nPublish a new version of ${chalk.bold.magenta(package_.name)} ${versionText}\n`);
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

	// Non-interactive mode - return before prompting
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
		if (!isScoped(package_.name)) {
			throw new Error('Unknown availability, but package is not scoped. This shouldn\'t happen');
		}

		const answers = await inquirer.prompt({
			confirm: {
				type: 'confirm',
				when: isScoped(package_.name) && options.runPublish,
				message: `Failed to check availability of scoped repo name ${chalk.bold.magenta(package_.name)}. Do you want to try and publish it anyway?`,
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

	const needsPrereleaseTag = answers => (
		options.runPublish
		&& (answers.version?.isPrerelease() || answers.customVersion?.isPrerelease())
		&& !options.tag
	);

	const alreadyPublicScoped = packageManager.id === 'yarn-berry' && options.runPublish && await util.getNpmPackageAccess(package_.name) === 'public';

	// Note that inquirer question.when is a bit confusing. Only `false` will cause the question to be skipped.
	// Any other value like `true` and `undefined` means ask the question.
	// so we make sure to always return an explicit boolean here to make it less confusing
	// see https://github.com/SBoudrias/Inquirer.js/pull/1340
	const needToAskForPublish = (() => {
		if (alreadyPublicScoped || !isScoped(package_.name) || !options.availability.isAvailable || options.availability.isUnknown || !options.runPublish) {
			return false;
		}

		if (!package_.publishConfig) {
			return true;
		}

		return package_.publishConfig.access !== 'restricted' && !npm.isExternalRegistry(package_);
	})();

	const answers = await inquirer.prompt({
		version: {
			type: 'list',
			message: 'Select SemVer increment or specify new version',
			pageSize: SEMVER_INCREMENTS.length + 2,
			choices: [
				...SEMVER_INCREMENTS.map(increment => ({ // TODO: prerelease prefix here too
					name: `${increment} 	${new Version(oldVersion, increment).format()}`,
					value: increment,
				})),
				new inquirer.Separator(),
				{
					name: 'Other (specify)',
					value: undefined,
				},
			],
			filter: input => input ? new Version(oldVersion, input) : input,
		},
		customVersion: {
			type: 'input',
			message: 'Version',
			when: answers => answers.version === undefined,
			filter(input) {
				if (SEMVER_INCREMENTS.includes(input)) {
					throw new Error('Custom version should not be a SemVer increment.');
				}

				const version = new Version(oldVersion);

				try {
					// Version error handling does validation
					version.setFrom(input);
				} catch (error) {
					if (error.message.includes('valid SemVer version')) {
						throw new Error(`Custom version ${input} should be a valid SemVer version.`);
					}

					error.message = error.message.replace('New', 'Custom');

					throw error;
				}

				return version;
			},
		},
		tag: {
			type: 'list',
			message: 'How should this pre-release version be tagged in npm?',
			when: answers => needsPrereleaseTag(answers),
			async choices() {
				const existingPrereleaseTags = await npm.prereleaseTags(package_.name);

				return [
					...existingPrereleaseTags,
					new inquirer.Separator(),
					{
						name: 'Other (specify)',
						value: undefined,
					},
				];
			},
		},
		customTag: {
			type: 'input',
			message: 'Tag',
			when: answers => answers.tag === undefined && needsPrereleaseTag(answers),
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
			when: needToAskForPublish,
			message: `This scoped repo ${chalk.bold.magenta(package_.name)} hasn't been published. Do you want to publish it publicly?`,
			default: false,
		},
	});

	return {
		...options,
		version: answers.version || answers.customVersion || options.version,
		tag: answers.tag || answers.customTag || options.tag,
		publishScoped: alreadyPublicScoped || answers.publishScoped,
		confirm: true,
		repoUrl,
		releaseNotes,
	};
};

export default ui;
