#!/usr/bin/env node
'use strict';
// eslint-disable-next-line import/no-unassigned-import
require('symbol-observable'); // Important: This needs to be first to prevent weird Observable incompatibilities
const logSymbols = require('log-symbols');
const meow = require('meow');
const updateNotifier = require('update-notifier');
const hasYarn = require('has-yarn');
const npmName = require('npm-name');
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
	  --any-branch  Allow publishing from any branch
	  --no-cleanup  Skips cleanup of node_modules
	  --yolo        Skips cleanup and testing
	  --no-publish  Skips publishing
	  --tag         Publish under a given dist-tag
	  --no-yarn     Don't use Yarn
	  --contents    Subdirectory to publish

	Examples
	  $ np
	  $ np patch
	  $ np 1.0.2
	  $ np 1.0.2-beta.3 --tag=beta
	  $ np 1.0.2-beta.3 --tag=beta --contents=dist
`, {
	flags: {
		anyBranch: {
			type: 'boolean'
		},
		cleanup: {
			type: 'boolean',
			default: true
		},
		yolo: {
			type: 'boolean'
		},
		publish: {
			type: 'boolean',
			default: true
		},
		tag: {
			type: 'string'
		},
		yarn: {
			type: 'boolean',
			default: hasYarn()
		},
		contents: {
			type: 'string'
		}
	}
});

updateNotifier({pkg: cli.pkg}).notify();

process.on('SIGINT', () => {
	console.log('\nAborted!');
	process.exit(1);
});

(async () => {
	const pkg = util.readPkg();

	const isAvailable = cli.flags.publish ? await npmName(pkg.name) : false;

	const options = cli.input.length > 0 ?
		{
			...cli.flags,
			confirm: true,
			version: cli.input[0]
		} :
		await ui({...cli.flags, exists: !isAvailable}, pkg);

	if (!options.confirm) {
		process.exit(0);
	}

	const newPkg = await np(options.version, options);
	console.log(`\n ${newPkg.name} ${newPkg.version} published 🎉`);
})().catch(error => {
	console.error(`\n${logSymbols.error} ${error.message}`);
	process.exit(1);
});
