'use strict';
const execa = require('execa');
const Listr = require('listr');
const pTimeout = require('p-timeout');
const version = require('./version');

module.exports = (input, pkg, options) => {
	const isExternalRegistry = typeof pkg.publishConfig === 'object' && typeof pkg.publishConfig.registry === 'string';
	let newVersion = null;

	const tasks = [
		{
			title: 'Ping npm registry',
			skip: () => pkg.private || isExternalRegistry,
			task: () => pTimeout(
				(async () => {
					try {
						await execa('npm', ['ping']);
					} catch (_) {
						throw new Error('Connection to npm registry failed');
					}
				})(),
				15000,
				'Connection to npm registry timed out'
			)
		},
		{
			title: 'Verify user is authenticated',
			skip: () => process.env.NODE_ENV === 'test' || pkg.private || isExternalRegistry,
			task: async () => {
				let username;
				try {
					username = await execa.stdout('npm', ['whoami']);
				} catch (error) {
					throw new Error(/ENEEDAUTH/.test(error.stderr) ?
						'You must be logged in to publish packages. Use `npm login` and try again.' :
						'Authentication error. Use `npm whoami` to troubleshoot.');
				}

				let collaborators;
				try {
					collaborators = await execa.stdout('npm', ['access', 'ls-collaborators', pkg.name]);
				} catch (error) {
					// Ignore non-existing package error
					if (error.stderr.includes('code E404')) {
						return;
					}

					throw error;
				}

				const json = JSON.parse(collaborators);
				const permissions = json[username];
				if (!permissions || !permissions.includes('write')) {
					throw new Error('You do not have write permissions required to publish this package.');
				}
			}
		},
		{
			title: 'Check git remote',
			task: async () => {
				try {
					await execa('git', ['ls-remote', 'origin', 'HEAD']);
				} catch (error) {
					throw new Error(error.stderr.replace('fatal:', 'Git fatal error:'));
				}
			}
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
				await execa('git', ['fetch']);

				const getTagVersionPrefix = () => {
					if (options.yarn) {
						return execa.stdout('yarn', ['config', 'get', 'version-tag-prefix']);
					}

					return execa.stdout('npm', ['config', 'get', 'tag-version-prefix']);
				};

				let tagPrefix = 'v';
				try {
					tagPrefix = await getTagVersionPrefix();
				} catch (_) {}

				try {
					const {stdout: revInfo} = await execa.stdout('git', ['rev-parse', '--quiet', '--verify', `refs/tags/${tagPrefix}${newVersion}`]);

					if (revInfo) {
						throw new Error(`Git tag \`${tagPrefix}${newVersion}\` already exists.`);
					}
				} catch (error) {
					// Command fails with code 1 and no output if the tag does not exist, even though `--quiet` is provided
					// https://github.com/sindresorhus/np/pull/73#discussion_r72385685
					if (error.stdout !== '' || error.stderr !== '') {
						throw error;
					}
				}
			}
		}
	];

	return new Listr(tasks);
};
