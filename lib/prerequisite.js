'use strict';
const semver = require('semver');
const execa = require('execa');
const Listr = require('listr');

const VERSIONS = ['major', 'minor', 'patch', 'premajor', 'preminor', 'prepatch', 'prerelease'];
const PRERELEASE_VERSIONS = ['premajor', 'preminor', 'prepatch', 'prerelease'];

module.exports = (input, pkg, opts) => {
	const newVersion = VERSIONS.indexOf(input) === -1 ? input : semver.inc(pkg.version, input);

	const tasks = [
		{
			title: 'Validate version',
			task: () => {
				if (VERSIONS.indexOf(input) === -1 && !semver.valid(input)) {
					throw new Error(`Version should be either ${VERSIONS.join(', ')}, or a valid semver version.`);
				}

				if (semver.gte(pkg.version, newVersion)) {
					throw new Error(`New version \`${newVersion}\` should be higher than current version \`${pkg.version}\``);
				}
			}
		},
		{
			title: 'Check for pre-release version',
			task: () => {
				if ((PRERELEASE_VERSIONS.indexOf(input) !== -1 || semver.prerelease(input)) && !opts.tag) {
					throw new Error('You must specify a dist-tag using --tag when publishing a pre-release version. This prevents accidentally tagging unstable versions as "latest". https://docs.npmjs.com/cli/dist-tag');
				}
			}
		},
		{
			title: 'Check npm version',
			skip: () => semver.lt(process.version, '6.0.0'),
			task: () => execa.stdout('npm', ['version', '--json']).then(json => {
				const versions = JSON.parse(json);
				if (!semver.satisfies(versions.npm, '>=2.15.8 <3.0.0 || >=3.10.1')) {
					throw new Error(`npm@${versions.npm} has known issues publishing when running Node.js 6. Please upgrade npm or downgrade Node and publish again. https://github.com/npm/npm/issues/5082`);
				}
			})
		},
		{
			title: 'Check git tag existence',
			task: () => execa('git', ['fetch'])
				.then(() => execa.stdout('git', ['rev-parse', '--quiet', '--verify', `refs/tags/v${newVersion}`]))
				.then(
					output => {
						if (output) {
							throw new Error(`Git tag \`v${newVersion}\` already exists.`);
						}
					},
					err => {
						// Command fails with code 1 and no output if the tag does not exist, even though `--quiet` is provided
						// https://github.com/sindresorhus/np/pull/73#discussion_r72385685
						if (err.stdout !== '' || err.stderr !== '') {
							throw err;
						}
					}
				)
		}
	];

	return new Listr(tasks);
};
