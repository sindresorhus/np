import process from 'node:process';
import Listr from 'listr';
import {execa} from 'execa';
import semver from 'semver';
import Version from './version.js';
import * as util from './util.js';
import * as git from './git-util.js';
import * as npm from './npm/util.js';
import {getOidcProvider} from './npm/oidc.js';

const prerequisiteTasks = (input, package_, options, {packageManager, rootDirectory}) => {
	const isExternalRegistry = npm.isExternalRegistry(package_);
	let newVersion;

	const tasks = [
		{
			title: 'Ping npm registry',
			enabled: () => !package_.private && !isExternalRegistry,
			task: async () => npm.checkConnection(),
		},
		{
			title: `Check ${packageManager.cli} version`,
			async task() {
				const {stdout: version} = await execa(packageManager.cli, ['--version']);
				util.validateEngineVersionSatisfies(packageManager.cli, version);
			},
		},
		{
			title: 'Verify user is authenticated',
			enabled: () => process.env.NODE_ENV !== 'test' && !package_.private,
			skip() {
				if (getOidcProvider()) {
					return 'Environment support for OIDC authentication detected - Skipping whoami check';
				}
			},
			async task() {
				const externalRegistry = package_.publishConfig?.registry;
				const username = await npm.username({externalRegistry});

				const collaborators = await npm.collaborators(package_);
				if (!collaborators) {
					return;
				}

				const json = JSON.parse(collaborators);
				const permissions = json[username];
				if (!permissions || !permissions.includes('write')) {
					throw new Error('You do not have write permissions required to publish this package.');
				}
			},
		},
		{
			title: 'Check git version',
			task: async () => git.verifyRecentGitVersion(),
		},
		{
			title: 'Check git user configuration',
			task: async () => git.verifyUserConfigIsSet(),
		},
		{
			title: 'Check git remote',
			task: async () => git.verifyRemoteIsValid(options.remote),
		},
		{
			title: 'Validate version',
			task() {
				newVersion = input instanceof Version
					? input
					: new Version(package_.version).setFrom(input);
			},
		},
		{
			title: 'Check for pre-release version',
			task() {
				if (!package_.private && newVersion.isPrerelease() && !options.tag) {
					throw new Error('You must specify a dist-tag using --tag when publishing a pre-release version. This prevents accidentally tagging unstable versions as "latest". https://docs.npmjs.com/cli/dist-tag');
				}
			},
		},
		{
			title: 'Check for Node.js engine support drop',
			enabled: () => !options.yolo && !package_.private,
			async task() {
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
					if (diff !== 'major' && diff !== 'premajor' && semver.major(package_.version) >= 1) {
						throw new Error(`Raising minimum Node.js version from ${publishedMinimum} to ${localMinimum} requires a major version bump. The current release is a ${diff} bump.`);
					}
				}
			},
		},
		{
			title: 'Verify package entry points',
			enabled: () => !options.yolo,
			async task() {
				await npm.verifyPackageEntryPoints(package_, rootDirectory);
			},
		},
		{
			title: 'Check git tag existence',
			async task() {
				await git.fetch();

				const tagPrefix = await util.getTagVersionPrefix(packageManager);

				await git.verifyTagDoesNotExistOnRemote(`${tagPrefix}${newVersion}`);
			},
		},
	];

	return new Listr(tasks);
};

export default prerequisiteTasks;
