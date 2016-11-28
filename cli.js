#!/usr/bin/env node
'use strict';
const meow = require('meow');
const readPkgUp = require('read-pkg-up');
const updateNotifier = require('update-notifier');
const version = require('./lib/version');
const ui = require('./lib/ui');
const np = require('./');

const cli = meow(`
	Usage
	  $ np <version>

	  Version can be:
	    ${version.SEMVER_INCREMENTS.join(' | ')} | 1.2.3

	Options
	  --any-branch    Allow publishing from any branch
	  --skip-cleanup  Skips cleanup of node_modules
	  --yolo          Skips cleanup and testing
	  --tag           Publish under a given dist-tag

	Examples
	  $ np
	  $ np patch
	  $ np 1.0.2
	  $ np 1.0.2-beta.3 --tag=beta
`);

updateNotifier({pkg: cli.pkg}).notify();

const pkg = readPkgUp.sync().pkg;
if (!pkg) {
	console.error('\nNo package.json found, are you in the correct project?');
	process.exit(1);
}

Promise
	.resolve()
	.then(() => {
		if (cli.input.length > 0) {
			return Object.assign({}, cli.flags, {
				confirm: true,
				version: cli.input[0]
			});
		}

		return ui(cli.flags, pkg);
	})
	.then(options => {
		if (!options.confirm) {
			process.exit(0);
		}

		return options;
	})
	.then(options => np(options.version, options, pkg))
	.then(pkg => {
		console.log(`\n ${pkg.name} ${pkg.version} published 🎉`);
	})
	.catch(err => {
		console.error(`\n${err.message}`);
		process.exit(1);
	});
