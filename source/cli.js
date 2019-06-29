#!/usr/bin/env node
'use strict';
// eslint-disable-next-line import/no-unassigned-import
require('symbol-observable'); // Important: This needs to be first to prevent weird Observable incompatibilities
const logSymbols = require('log-symbols');
const meow = require('meow');
const updateNotifier = require('update-notifier');
const hasYarn = require('has-yarn');
const config = require('./config');
const {isPackageNameAvailable} = require('./npm/util');
const version = require('./version');
const util = require('./util');
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
	  --no-tests          Skips tests
	  --yolo              Skips cleanup and testing
	  --no-publish        Skips publishing
	  --tag               Publish under a given dist-tag
	  --no-yarn           Don't use Yarn
	  --contents          Subdirectory to publish
	  --no-release-draft  Skips opening a GitHub release draft

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
		tests: {
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
		}
	}
});

updateNotifier({pkg: cli.pkg}).notify();

(async () => {
	const pkg = util.readPkg();

	const defaultFlags = {
		cleanup: true,
		tests: true,
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

	const version = cli.input.length > 0 ? cli.input[0] : false;

	const options = await ui({...flags, exists: !isAvailable, version}, pkg);

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
