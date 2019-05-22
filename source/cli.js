#!/usr/bin/env node
'use strict';
// eslint-disable-next-line import/no-unassigned-import
require('symbol-observable'); // Important: This needs to be first to prevent weird Observable incompatibilities
const logSymbols = require('log-symbols');
const meow = require('meow');
const updateNotifier = require('update-notifier');
const hasYarn = require('has-yarn');
const githubUrlFromGit = require('github-url-from-git');
const chalk = require('chalk');
const config = require('./config');
const {isPackageNameAvailable} = require('./npm/util');
const version = require('./version');
const util = require('./util');
const detectVersion = require('./detect-version');
const ui = require('./ui');
const np = require('.');

const cli = meow(`
	Usage
	  $ np <version>

	  Version can be:
	    ${version.SEMVER_INCREMENTS.join(' | ')} | 1.2.3

	Options
	  --any-branch        Allow publishing from any branch
	  --no-cleanup        Skips cleanup of node_modules
	  --yolo              Skips cleanup and testing
	  --no-publish        Skips publishing
	  --tag               Publish under a given dist-tag
	  --no-yarn           Don't use Yarn
	  --contents          Subdirectory to publish
	  --no-release-draft  Skips opening a GitHub release draft
	  --auto              Categorize changes and determine version automatically

	Examples
	  $ np
	  $ np patch
	  $ np 1.0.2
	  $ np 1.0.2-beta.3 --tag=beta
	  $ np 1.0.2-beta.3 --tag=beta --contents=dist
`, {
	booleanDefault: undefined,
	flags: {
		anyBranch: {
			type: 'boolean'
		},
		cleanup: {
			type: 'boolean'
		},
		yolo: {
			type: 'boolean'
		},
		publish: {
			type: 'boolean'
		},
		releaseDraft: {
			type: 'boolean',
			default: true
		},
		tag: {
			type: 'string'
		},
		yarn: {
			type: 'boolean'
		},
		contents: {
			type: 'string'
		},
		auto: {
			type: 'boolean'
		}
	}
});

updateNotifier({pkg: cli.pkg}).notify();

(async () => {
	const pkg = util.readPkg();

	const defaultFlags = {
		cleanup: true,
		publish: true,
		yarn: hasYarn()
	};

	const localConfig = await config();

	const flags = {
		...defaultFlags,
		...localConfig,
		...cli.flags
	};

	const isAvailable = flags.publish ? await isPackageNameAvailable(pkg) : false;
	let options = {
		...flags,
		confirm: true,
		exists: !isAvailable,
		version: cli.input[0]
	};

	if (cli.input.length === 0) {
		console.log(`\nPublish a new version of ${chalk.bold.magenta(pkg.name)} ${chalk.dim(`(current: ${pkg.version})`)}\n`);

		const extraBaseUrls = ['gitlab.com'];
		const repoUrl = pkg.repository && githubUrlFromGit(pkg.repository.url, {extraBaseUrls});

		if (cli.flags.auto) {
			options = await detectVersion({...flags, exists: !isAvailable, repoUrl}, pkg);
		} else {
			options = await ui({...flags, exists: !isAvailable, repoUrl}, pkg);
		}
	}

	if (!options.confirm) {
		process.exit(0);
	}

	console.log(); // Prints a newline for readability
	const newPkg = await np(options.version, options);
	console.log(`\n ${newPkg.name} ${newPkg.version} published 🎉`);
})().catch(error => {
	console.error(`\n${logSymbols.error} ${error.message}`);
	process.exit(1);
});
