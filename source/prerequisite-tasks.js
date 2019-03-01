'use strict';
const Listr = require('listr');
const execa = require('execa');
const version = require('./version');
const git = require('./git-util');
const npm = require('./npm-util');
const {getTagVersionPrefix} = require('./util');
const {isExternalRegistry} = require('./npm/check-name');

module.exports = (input, pkg, options) => {
	const isExternal = isExternalRegistry(pkg);
	let newVersion = null;

	const tasks = [
		{
			title: 'Ping npm registry',
			skip: () => pkg.private || isExternal,
			task: async () => npm.checkConnection()
		},
		{
			title: 'Check npm version',
			task: async () => {
				const versions = JSON.parse(await execa.stdout('npm', ['version', '--json']));

				if (version.satisfies(versions.npm, '<6.8.0')) {
					throw new Error('Please upgrade to npm@6.8.0 or newer');
				}
			}
		},
		{
			title: 'Verify user is authenticated',
			skip: () => process.env.NODE_ENV === 'test' || pkg.private || isExternal,
			task: async () => {
				const username = await npm.username();

				const collaborators = await npm.collaborators(pkg.name);
				if (!collaborators) {
					return;
				}

				const json = JSON.parse(collaborators);
				const permissions = json[username];
				if (!permissions || !permissions.includes('write')) {
					throw new Error('You do not have write permissions required to publish this package.');
				}
			}
		},
		{
			title: 'Verify git version is recent',
			task: async () => git.verifyRecentGitVersion()
		},
		{
			title: 'Check git remote',
			task: async () => git.verifyRemoteIsValid()
		},
		{
			title: 'Validate version',
			task: () => {
				if (!version.isValidVersionInput(input)) {
					throw new Error(`Version should be either ${version.SEMVER_INCREMENTS.join(', ')}, or a valid semver version.`);
				}

				newVersion = version.getNewVersion(pkg.version, input);

				if (!version.isVersionGreater(pkg.version, newVersion)) {
					throw new Error(`New version \`${newVersion}\` should be higher than current version \`${pkg.version}\``);
				}
			}
		},
		{
			title: 'Check for pre-release version',
			task: () => {
				if (!pkg.private && version.isPrereleaseVersion(newVersion) && !options.tag) {
					throw new Error('You must specify a dist-tag using --tag when publishing a pre-release version. This prevents accidentally tagging unstable versions as "latest". https://docs.npmjs.com/cli/dist-tag');
				}
			}
		},
		{
			title: 'Check git tag existence',
			task: async () => {
				await git.fetch();

				const tagPrefix = await getTagVersionPrefix(options);

				await git.verifyTagDoesNotExistOnRemote(`${tagPrefix}${newVersion}`);
			}
		}
	];

	return new Listr(tasks);
};
