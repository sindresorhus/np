import process from 'node:process';
import {execa} from 'execa';
import semver from 'semver';
import {PresentableError} from 'presentable-error';
import Version from './version.js';
import * as util from './util.js';
import * as git from './git-util.js';
import * as npm from './npm/util.js';
import {getOidcProvider} from './npm/oidc.js';
import {TaskList} from './task-list/index.js';

export default function prerequisiteTasks(input, package_, options, {packageManager, rootDirectory}) {
	const isExternalRegistry = npm.isExternalRegistry(package_);

	// The tasks run concurrently, so each task that needs the new version computes it itself instead of waiting for the `Validate version` task.
	const getNewVersion = () => input instanceof Version
		? input
		: new Version(package_.version).setFrom(input);

	const tasks = [
		{
			title: 'Ping npm registry',
			enabled: !package_.private && !isExternalRegistry,
			run: async () => npm.checkConnection(),
		},
		{
			title: `Check ${packageManager.cli} version`,
			async run() {
				const {stdout: version} = await execa(packageManager.cli, ['--version']);
				util.validateEngineVersionSatisfies(packageManager.cli, version);
			},
		},
		{
			title: 'Verify user is authenticated',
			enabled: process.env.NODE_ENV !== 'test' && !package_.private && !options.dryRun,
			skip() {
				if (getOidcProvider()) {
					return 'Environment support for OIDC authentication detected - Skipping whoami check';
				}
			},
			async run() {
				// Use the exact publish registry (if any) so this check can't disagree with the early auth check. See #764.
				const externalRegistry = package_.publishConfig?.registry;
				const username = await npm.username({externalRegistry});

				const collaborators = await npm.collaborators(package_);
				if (!collaborators) {
					return;
				}

				const json = JSON.parse(collaborators);
				const permissions = json[username];
				if (!permissions || !permissions.includes('write')) {
					throw new PresentableError('You do not have write permissions required to publish this package.');
				}
			},
		},
		{
			title: 'Check git version',
			run: async () => git.verifyRecentGitVersion(),
		},
		{
			title: 'Check git user configuration',
			run: async () => git.verifyUserConfigIsSet(),
		},
		{
			title: 'Validate version',
			run() {
				getNewVersion();
			},
		},
		{
			title: 'Check for pre-release version',
			run() {
				if (!package_.private && getNewVersion().isPrerelease() && (!options.tag || options.tag.toLowerCase() === 'latest')) {
					throw new PresentableError('You must specify a dist-tag using --tag when publishing a pre-release version. This prevents accidentally tagging unstable versions as "latest". https://docs.npmjs.com/cli/dist-tag');
				}
			},
		},
		{
			title: 'Check for Node.js engine support drop',
			enabled: !options.yolo && !package_.private,
			async run() {
				const newVersion = getNewVersion();
				const publishedEngines = await npm.getPublishedPackageEngines(package_);

				// Skip if this is the first publish or if published package has no engines.node
				if (!publishedEngines?.node) {
					return;
				}

				const localNodeEngine = package_.engines?.node;

				// Skip if local package has no engines.node (we can't compare)
				if (!localNodeEngine) {
					return;
				}

				const publishedMinimum = util.getMinimumNodeVersion(publishedEngines.node);
				const localMinimum = util.getMinimumNodeVersion(localNodeEngine);

				// Skip if we couldn't parse either version
				if (!publishedMinimum || !localMinimum) {
					return;
				}

				// Check if the minimum Node.js version has increased
				if (semver.gt(localMinimum, publishedMinimum)) {
					const diff = semver.diff(package_.version, newVersion.toString());

					// Only major and premajor releases are allowed to drop Node.js support
					// For pre-1.0.0 packages, minor bumps are considered breaking changes per semver
					const isPre1MinorRelease = semver.major(package_.version) === 0 && (diff === 'minor' || diff === 'preminor');
					if (diff !== 'major' && diff !== 'premajor' && diff !== 'prerelease' && !isPre1MinorRelease) {
						throw new PresentableError(`Raising minimum Node.js version from ${publishedMinimum} to ${localMinimum} requires a major version bump. The current release is a ${diff} bump.`);
					}
				}
			},
		},
		{
			title: 'Verify package entry points',
			enabled: !options.yolo,
			skip() {
				if (['pnpm', 'yarn-berry'].includes(packageManager.id) && ['main', 'bin', 'exports'].some(field => Object.hasOwn(package_.publishConfig ?? {}, field))) {
					return 'Entry point inspection is unavailable for publishConfig entry point overrides.';
				}
			},
			async run() {
				// Read the setting from the package manager that performs the publish. Yarn Berry doesn't expose the `ignore-scripts` setting, so its publish continues to trust lifecycle scripts.
				const ignoreScripts = packageManager.ignoreScriptsCli
					? await npm.isIgnoreScriptsEnabled(rootDirectory, packageManager.ignoreScriptsCli)
					: false;
				await npm.verifyPackageEntryPoints(package_, rootDirectory, {
					ignoreScripts,
					ignoreScriptsConfigFile: packageManager.ignoreScriptsConfigFile,
				});
			},
		},
		{
			title: 'Check git remote and tag existence',
			async run() {
				const remote = options.remote ?? (await git.hasUpstream() ? await git.getUpstreamRemote() : undefined);
				// Both commands inherit stdin for SSH passphrase prompts, so they must not run at the same time as each other. Keeping them in one task keeps them sequential while the other tasks run concurrently.
				// Limitation: The task list keeps drawing during the commands, so it can draw over an SSH passphrase prompt.
				await git.verifyRemoteIsValid(remote);

				// Fetch is needed so `tagExistsOnRemote` can check local refs. Don't replace with `ls-remote`.
				await git.fetch(remote);

				const tagPrefix = await util.getTagVersionPrefix(packageManager);

				await git.verifyTagDoesNotExistOnRemote(`${tagPrefix}${getNewVersion()}`);
			},
		},
	];

	// Most of these checks are network round trips, so running them concurrently cuts the total time to the slowest one.
	return new TaskList(tasks, {concurrent: true});
}
