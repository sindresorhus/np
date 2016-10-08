'use strict';
const execa = require('execa');
const inquirer = require('inquirer');
const readPkgUp = require('read-pkg-up');
const version = require('./version');

module.exports = options => {
	const pkg = readPkgUp.sync().pkg;

	const prompts = [
		{
			type: 'list',
			name: 'version',
			message: 'Select semver increment or specify new version',
			choices: version.SEMVER_INCREMENTS.concat([
				new inquirer.Separator(),
				{
					name: 'Other (specify)',
					value: null
				}
			]),
			filter(input) {
				return version.isValidVersionInput(input) ? version.getNewVersion(pkg.version, input) : input;
			}
		},
		{
			type: 'input',
			name: 'version',
			message: 'Version',
			when(answers) {
				return !answers.version;
			},
			filter(input) {
				// filter runs before validate that's why we have to check for valid version before we transform them
				return version.isValidVersionInput(input) ? version.getNewVersion(pkg.version, input) : input;
			},
			validate(input) {
				if (!version.isValidVersionInput(input)) {
					return 'Please specify a valid semver, e.g. 1.2.3. See http://semver.org/';
				} else if (!version.isVersionGreater(pkg.version, input)) {
					return `Version must be greater than ${pkg.version}`;
				}
				return true;
			}
		},
		{
			type: 'list',
			name: 'tag',
			message: 'How should this pre-release version be tagged in NPM?',
			when(answers) {
				return !pkg.private && version.isPrereleaseVersion(answers.version) && !options.tag;
			},
			choices() {
				return execa.stdout('npm', ['dist-tag', 'ls'])
					.then(stdout => {
						const existingPreleaseTags = stdout.split('\n')
							.map(line => line.split(':')[0].replace(/^\s|\s$/, ''))
							.filter(line => line)
							.filter(line => line.toLowerCase() !== 'latest');

						if (!existingPreleaseTags.length) {
							existingPreleaseTags.push('next');
						}

						return existingPreleaseTags
							.concat([
								new inquirer.Separator(),
								{
									name: 'Other (specify)',
									value: null
								}
							]);
					});
			}
		},
		{
			type: 'input',
			name: 'tag',
			message: 'Tag',
			when(answers) {
				return !pkg.private && version.isPrereleaseVersion(answers.version) && !options.tag && !answers.tag;
			},
			validate(input) {
				if (!input.length) {
					return `Please specify a tag, e.g. next.`;
				} else if (input.toLowerCase() === 'latest') {
					return `It's not possible to publish a pre-releases under the latest tag. Please specifiy something else, e.g. next.`;
				}
				return true;
			}
		},
		{
			type: 'confirm',
			name: 'confirm',
			message(answers) {
				const tag = answers.tag || options.tag;
				const msg = `Will bump from ${pkg.version} to ${answers.version}${tag ? ` and tag this release in NPM as ${tag}` : ''}. Continue?`;
				return msg;
			}
		}
	];

	return inquirer
		.prompt(prompts)
		.then(answers => Object.assign({}, options, answers));
};
