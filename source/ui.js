import inquirer from 'inquirer';
import chalk from 'chalk';
import githubUrlFromGit from 'github-url-from-git';
import hostedGitInfo from 'hosted-git-info';
import {htmlEscape} from 'escape-goat';
import isScoped from 'is-scoped';
import isInteractive from 'is-interactive';
import {execa} from 'execa';
import semver from 'semver';
import Version, {SEMVER_INCREMENTS} from './version.js';
import * as util from './util.js';
import * as git from './git-util.js';
import * as npm from './npm/util.js';

const PRERELEASE_INCREMENTS = new Set([
	'prepatch',
	'preminor',
	'premajor',
	'prerelease',
]);

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
			generateReleaseNotes() {},
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

	const generateReleaseNotes = nextTag => commits.map(commit =>
		`- ${htmlEscape(commit.message)}  ${commit.id}`).join('\n') + `\n\n---\n\n${repoUrl}/compare/${revision}...${nextTag}`;

	const commitRange = util.linkifyCommitRange(repoUrl, commitRangeText);
	console.log(`${chalk.bold('Commits:')}\n${history}\n\n${chalk.bold('Commit Range:')}\n${commitRange}\n\n${chalk.bold('Registry:')}\n${registryUrl}\n`);

	return {
		hasCommits: true,
		hasUnreleasedCommits,
		generateReleaseNotes,
	};
};

const checkNewFilesAndDependencies = async (package_, rootDirectory) => {
	const newFiles = await util.getNewFiles(rootDirectory);
	const newDependencies = await util.getNewDependencies(package_, rootDirectory);

	const noNewFirstTimeFiles = !newFiles.firstTime || newFiles.firstTime.length === 0;
	const noNewDependencies = !newDependencies || newDependencies.length === 0;

	// Only prompt for first-time files and new dependencies (things that WILL be published)
	if (noNewFirstTimeFiles && noNewDependencies) {
		return {
			confirmed: true,
			unpublishedFiles: newFiles.unpublished || [],
		};
	}

	const messages = [];
	if (newFiles.firstTime.length > 0) {
		messages.push(`The following new files will be published for the first time:\n${util.joinList(newFiles.firstTime)}\n\nPlease make sure only the intended files are listed.`);
	}

	if (newDependencies.length > 0) {
		messages.push(`The following new dependencies will be part of your published package:\n${util.joinList(newDependencies)}\n\nPlease make sure these new dependencies are intentional.`);
	}

	if (!isInteractive()) {
		console.log(messages.join('\n'));
		return {
			confirmed: true,
			unpublishedFiles: newFiles.unpublished || [],
		};
	}

	const answers = await inquirer.prompt([{
		type: 'confirm',
		name: 'confirm',
		message: `${messages.join('\n')}\nContinue?`,
		default: false,
	}]);

	return {
		confirmed: answers.confirm,
		unpublishedFiles: newFiles.unpublished || [],
	};
};

const displayUnpublishedFilesWarning = unpublishedFiles => {
	if (!unpublishedFiles || unpublishedFiles.length === 0) {
		return;
	}

	console.log([
		'',
		chalk.yellow('⚠ WARNING: The following new files will NOT be published:'),
		chalk.dim(util.groupFilesInFolders(unpublishedFiles)),
		'',
		chalk.yellow('These files are excluded by your package.json "files" field.'),
		chalk.yellow('If you intended to publish them, add them to the "files" field.'),
		'',
	].join('\n'));
};

/**
@param {import('./cli-implementation.js').CLI['flags']} options
@param {{package_: import('read-pkg').NormalizedPackageJson; rootDirectory: string}} context
*/
const ui = async ({packageManager, ...options}, {package_, rootDirectory}) => { // eslint-disable-line complexity
	const oldVersion = package_.version;
	const extraBaseUrls = ['gitlab.com'];
	const repoUrl = package_.repository && (() => {
		// Try to parse with hosted-git-info first to handle shorthand URLs like "github:foo/bar"
		const gitInfo = hostedGitInfo.fromUrl(package_.repository.url);
		if (gitInfo?.browse) {
			return gitInfo.browse({noCommittish: true});
		}

		// Fall back to github-url-from-git for GitLab and other known hosts
		const githubUrl = githubUrlFromGit(package_.repository.url, {extraBaseUrls});
		if (githubUrl) {
			return githubUrl;
		}

		// Final fallback: parse any git URL format (handles GitHub Enterprise and other hosts)
		return util.parseGitUrl(package_.repository.url);
	})();

	const {stdout: registryUrl} = await execa(...packageManager.getRegistryCommand);
	const releaseBranch = options.branch;

	let unpublishedFiles;
	if (options.runPublish) {
		await npm.checkIgnoreStrategy(package_, rootDirectory);

		const {confirmed, unpublishedFiles: files} = await checkNewFilesAndDependencies(package_, rootDirectory);
		unpublishedFiles = files;
		if (!confirmed) {
			return {
				...options,
				confirm: confirmed,
			};
		}
	}

	if (options.releaseDraftOnly) {
		console.log(`\nCreate a release draft on GitHub for ${chalk.bold.magenta(package_.name)} ${chalk.dim(`(current: ${oldVersion})`)}\n`);
	} else {
		const versionText = options.version
			? chalk.dim(`(current: ${oldVersion}, next: ${new Version(oldVersion).setFrom(options.version, {prereleasePrefix: await util.getPreReleasePrefix(packageManager)}).format()})`)
			: chalk.dim(`(current: ${oldVersion})`);

		console.log(`\nPublish a new version of ${chalk.bold.magenta(package_.name)} ${versionText}\n`);
	}

	const useLatestTag = !options.releaseDraftOnly;
	const {hasCommits, hasUnreleasedCommits, generateReleaseNotes} = await printCommitLog(repoUrl, registryUrl, useLatestTag, releaseBranch);

	// Display unpublished files warning after commit log
	displayUnpublishedFilesWarning(unpublishedFiles);

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
	// But if it's a prerelease without a tag, we need to prompt for the tag
	if (options.version) {
		const prereleasePrefix = await util.getPreReleasePrefix(packageManager);
		const versionObject = new Version(oldVersion).setFrom(options.version, {prereleasePrefix});
		const needsTag = options.runPublish && versionObject.isPrerelease() && !options.tag;

		if (!needsTag) {
			return {
				...options,
				confirm: true,
				repoUrl,
				generateReleaseNotes,
			};
		}

		// Prompt for tag only
		const answers = await inquirer.prompt({
			tag: {
				type: 'select',
				message: 'How should this pre-release version be tagged in npm?',
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
				when: answers => answers.tag === undefined,
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
		});

		return {
			...options,
			tag: answers.tag || answers.customTag || options.tag,
			confirm: true,
			repoUrl,
			generateReleaseNotes,
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

	const needsPrereleaseTag = answers => {
		if (!options.runPublish || options.tag) {
			return false;
		}

		// Check if version is a prerelease increment
		if (answers.version) {
			return PRERELEASE_INCREMENTS.has(answers.version);
		}

		// Check if custom version is a prerelease
		return answers.customVersion?.isPrerelease();
	};

	const alreadyPublicScoped = packageManager.id === 'yarn-berry' && options.runPublish && await util.getNpmPackageAccess(package_) === 'public';

	// Note that inquirer question.when is a bit confusing. Only `false` will cause the question to be skipped.
	// Any other value like `true` and `undefined` means ask the question.
	// so we make sure to always return an explicit boolean here to make it less confusing
	// see https://github.com/SBoudrias/Inquirer.js/pull/1340
	const needToAskForPublish = (() => {
		if (alreadyPublicScoped || !isScoped(package_.name) || !options.availability.isAvailable || options.availability.isUnknown || !options.runPublish) {
			return false;
		}

		// Only ask if access is not explicitly set and not using an external registry
		return !package_.publishConfig?.access && !npm.isExternalRegistry(package_);
	})();

	// Extract prerelease identifier from current version if it exists, otherwise use npm config
	const currentPrerelease = semver.prerelease(oldVersion);
	// Only use the prefix if it's a string (not a number like in '1.0.0-0')
	const currentPrereleasePrefix = typeof currentPrerelease?.[0] === 'string' ? currentPrerelease[0] : undefined;
	const configPrereleasePrefix = await util.getPreReleasePrefix(packageManager);
	const defaultPrereleasePrefix = currentPrereleasePrefix ?? configPrereleasePrefix;

	const answers = await inquirer.prompt({
		version: {
			type: 'select',
			message: 'Select SemVer increment or specify new version',
			pageSize: SEMVER_INCREMENTS.length + 2,
			default: 0,
			choices: [
				...SEMVER_INCREMENTS.map(increment => ({
					name: `${increment} 	${new Version(oldVersion, increment, {prereleasePrefix: defaultPrereleasePrefix}).format()}`,
					value: increment,
				})),
				new inquirer.Separator(),
				{
					name: 'Other (specify)',
					value: undefined,
				},
			],
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
		prereleasePrefix: {
			type: 'input',
			message: 'Prerelease identifier',
			// Use || not ?? to treat empty string as falsy (show 'rc' instead of empty default)
			default: defaultPrereleasePrefix || 'rc',
			when(answers) {
				// Only ask when a prerelease increment was selected from the menu
				if (!answers.version) {
					return false;
				}

				return PRERELEASE_INCREMENTS.has(answers.version);
			},
		},
		tag: {
			type: 'select',
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

	// Create Version object with custom prerelease prefix if provided
	let version;
	if (answers.version) {
		// Use || not ?? to treat empty string as falsy (fall back to default/rc)
		const prereleasePrefix = answers.prereleasePrefix || defaultPrereleasePrefix;
		version = new Version(oldVersion, answers.version, {prereleasePrefix});
	} else if (answers.customVersion) {
		version = answers.customVersion;
	} else {
		version = options.version;
	}

	return {
		...options,
		version,
		tag: answers.tag || answers.customTag || options.tag,
		publishScoped: alreadyPublicScoped || answers.publishScoped,
		confirm: true,
		repoUrl,
		generateReleaseNotes,
	};
};

export default ui;
