'use strict';
const inquirer = require('inquirer');
const version = require('./version');
const git = require('./git-util');
const getCommits = require('./get-commits');
const printCommitLog = require('./print-commit-log');

const listCommits = commits => {
	return commits.map(commit => `- ${commit.message}  ${commit.id}`);
};

const generateReleaseNotes = (commits, repoUrl, latest, nextTag) => {
	const output = [];

	const majorChanges = commits.filter(commit => commit.type === 'major');
	const minorChanges = commits.filter(commit => commit.type === 'minor');
	const patchChanges = commits.filter(commit => commit.type === 'patch');

	if (majorChanges.length > 0) {
		output.push('## Breaking changes', '', ...listCommits(majorChanges), '');
	}

	if (minorChanges.length > 0) {
		output.push('## Features', '', ...listCommits(minorChanges), '');
	}

	if (patchChanges.length > 0) {
		output.push('## Bug fixes', '', ...listCommits(patchChanges), '');
	}

	output.push('## All changes', '', `${repoUrl}/compare/${latest}...${nextTag}`);

	return output.join('\n');
};

// Ask user about each commit and automatically determine the next release version
module.exports = async (options, pkg) => {
	const commits = await getCommits();

	if (commits.length === 0) {
		const answers = await inquirer.prompt([{
			type: 'confirm',
			name: 'confirm',
			message: 'No commits found since previous release, continue?',
			default: false
		}]);

		if (!answers.confirm) {
			return {
				...options,
				...answers
			};
		}
	}

	await printCommitLog(commits, options.repoUrl);

	const prompts = commits.map(commit => ({
		type: 'list',
		name: commit.id,
		message: `What kind of change does "${commit.message}" commit contain?`,
		choices: [
			{
				name: 'Bug fix',
				value: 'patch'
			},
			{
				name: 'Feature',
				value: 'minor'
			},
			{
				name: 'Breaking change',
				value: 'major'
			},
			{
				name: 'Docs',
				value: 'docs'
			},
			{
				name: 'Other',
				value: 'other'
			}
		]
	}));

	const answers = await inquirer.prompt(prompts);

	for (const [id, type] of Object.entries(answers)) {
		const commit = commits.find(commit => commit.id === id);
		commit.type = type;
	}

	const hasMajorChanges = commits.some(commit => commit.type === 'major');
	const hasMinorChanges = commits.some(commit => commit.type === 'minor');
	let bumpType = 'patch';

	if (hasMinorChanges) {
		bumpType = 'minor';
	}

	if (hasMajorChanges) {
		bumpType = 'major';
	}

	const nextVersion = version(pkg.version).getNewVersionFrom(bumpType);

	const {confirm} = await inquirer.prompt([{
		type: 'confirm',
		name: 'confirm',
		message: `Determined next version to be ${nextVersion}, continue?`,
		default: false
	}]);

	if (!confirm) {
		return {
			...options,
			confirm
		};
	}

	const latest = await git.latestTagOrFirstCommit();
	const releaseNotes = nextTag => generateReleaseNotes(commits, options.repoUrl, latest, nextTag);

	return {
		...options,
		confirm: true,
		version: nextVersion,
		releaseNotes
	};
};
