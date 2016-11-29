'use strict';
const execa = require('execa');
const inquirer = require('inquirer');
const chalk = require('chalk');
const util = require('./util');
const version = require('./version');

module.exports = options => {
	const pkg = util.readPkg();
	const oldVersion = pkg.version;

	console.log(`\nPublish a new version of ${chalk.bold.magenta(pkg.name)} ${chalk.dim(`(${oldVersion})`)}\n`);

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
					return 'Please specify a valid semver, for example, `1.2.3`. See http://semver.org';
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
			choices: () => execa.stdout('npm', ['view', '--json', pkg.name, 'dist-tags'])
				.then(stdout => {
					const existingPrereleaseTags = Object.keys(JSON.parse(stdout))
						.filter(tag => tag !== 'latest');

					if (existingPrereleaseTags.length === 0) {
						existingPrereleaseTags.push('next');
					}

					return existingPrereleaseTags
						.concat([
							new inquirer.Separator(),
							{
								name: 'Other (specify)',
								value: null
							}
						]);
				})
		},
		{
			type: 'input',
			name: 'tag',
			message: 'Tag',
			when: answers => !pkg.private && version.isPrereleaseVersion(answers.version) && !options.tag && !answers.tag,
			validate: input => {
				if (input.length === 0) {
					return 'Please specify a tag, for example, `next`.';
				} else if (input.toLowerCase() === 'latest') {
					return 'It\'s not possible to publish pre-releases under the `latest` tag. Please specify something else, for example, `next`.';
				}
				return true;
			}
		},
		{
			type: 'confirm',
			name: 'confirm',
			message: answers => {
				const tag = answers.tag || options.tag;
				const tagPart = tag ? ` and tag this release in npm as ${tag}` : '';

				return `Will bump from ${chalk.cyan(oldVersion)} to ${chalk.cyan(answers.version + tagPart)}. Continue?`;
			}
		}
	];

	return inquirer
		.prompt(prompts)
		.then(answers => Object.assign({}, options, answers));
};
