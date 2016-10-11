'use strict';
const execa = require('execa');
const inquirer = require('inquirer');
const readPkgUp = require('read-pkg-up');
const chalk = require('chalk');
const version = require('./version');

module.exports = options => {
	const pkg = readPkgUp.sync().pkg;
	const oldVersion = pkg.version;

	console.log('\n');
	console.log(`Releasing a new version of ${chalk.bold(pkg.name)} ${chalk.gray.dim(`(current version: ${oldVersion})`)}`);
	console.log('\n');

	const prompts = [
		{
			type: 'list',
			name: 'version',
			message: 'Select semver increment or specify new version',
			choices: version.SEMVER_INCREMENTS
				.map(inc => ({
					name: `${inc} ${chalk.gray.dim(`(${version.getNewVersion(oldVersion, inc)})`)}`,
					value: inc
				}))
				.concat([
					new inquirer.Separator(),
					{
						name: 'Other (specify)',
						value: null
					}
				]),
			filter: input => version.isValidVersionInput(input) ? version.getNewVersion(oldVersion, input) : input
		},
		{
			type: 'input',
			name: 'version',
			message: 'Version',
			when: answers => !answers.version,
			filter: input => version.isValidVersionInput(input) ? version.getNewVersion(pkg.version, input) : input,
			validate: input => {
				if (!version.isValidVersionInput(input)) {
					return 'Please specify a valid semver, e.g. 1.2.3. See http://semver.org';
				} else if (!version.isVersionGreater(oldVersion, input)) {
					return `Version must be greater than ${oldVersion}`;
				}
				return true;
			}
		},
		{
			type: 'list',
			name: 'tag',
			message: 'How should this pre-release version be tagged in npm?',
			when: answers => !pkg.private && version.isPrereleaseVersion(answers.version) && !options.tag,
			choices: () => {
				return execa.stdout('npm', ['dist-tag', 'ls'])
					.then(stdout => {
						const existingPreleaseTags = stdout.split('\n')
							.map(line => line.split(':')[0].replace(/^\s|\s$/, ''))
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
			when: answers => !pkg.private && version.isPrereleaseVersion(answers.version) && !options.tag && !answers.tag,
			validate: input => {
				if (input.length === 0) {
					return 'Please specify a tag, e.g. next.';
				} else if (input.toLowerCase() === 'latest') {
					return 'It\'s not possible to publish pre-releases under the latest tag. Please specifiy something else, e.g. next.';
				}
				return true;
			}
		},
		{
			type: 'confirm',
			name: 'confirm',
			message: answers => {
				const tag = answers.tag || options.tag;
				const msg = `Will bump from ${oldVersion} to ${answers.version}${tag ? ` and tag this release in npm as ${tag}` : ''}. Continue?`;
				return msg;
			}
		}
	];

	return inquirer
		.prompt(prompts)
		.then(answers => Object.assign({}, options, answers));
};
