import process from 'node:process';
import Listr from 'listr';
import {execa} from 'execa';
import Version from './version.js';
import * as util from './util.js';
import * as git from './git-util.js';
import * as npm from './npm/util.js';

const prerequisiteTasks = (input, pkg, options) => {
	const isExternalRegistry = npm.isExternalRegistry(pkg);
	let newVersion;

	const tasks = [
		{
			title: 'Ping npm registry',
			enabled: () => !pkg.private && !isExternalRegistry,
			task: async () => npm.checkConnection(),
		},
		{
			title: 'Check npm version',
			task: async () => npm.verifyRecentNpmVersion(),
		},
		{
			title: 'Check yarn version',
			enabled: () => options.yarn === true,
			async task() {
				const {stdout: yarnVersion} = await execa('yarn', ['--version']);
				util.validateEngineVersionSatisfies('yarn', yarnVersion);
			},
		},
		{
			title: 'Verify user is authenticated',
			enabled: () => process.env.NODE_ENV !== 'test' && !pkg.private,
			async task() {
				const username = await npm.username({
					externalRegistry: isExternalRegistry ? pkg.publishConfig.registry : false,
				});

				const collaborators = await npm.collaborators(pkg);
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
			title: 'Check git remote',
			task: async () => git.verifyRemoteIsValid(),
		},
		{
			title: 'Validate version',
			task() {
				newVersion = input instanceof Version
					? input
					: new Version(pkg.version).setFrom(input);
			},
		},
		{
			title: 'Check for pre-release version',
			task() {
				if (!pkg.private && newVersion.isPrerelease() && !options.tag) {
					throw new Error('You must specify a dist-tag using --tag when publishing a pre-release version. This prevents accidentally tagging unstable versions as "latest". https://docs.npmjs.com/cli/dist-tag');
				}
			},
		},
		{
			title: 'Check git tag existence',
			async task() {
				await git.fetch();

				const tagPrefix = await util.getTagVersionPrefix(options);

				await git.verifyTagDoesNotExistOnRemote(`${tagPrefix}${newVersion}`);
			},
		},
	];

	return new Listr(tasks);
};

export default prerequisiteTasks;
