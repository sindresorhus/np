#!/usr/bin/env node
'use strict';
const meow = require('meow');
const updateNotifier = require('update-notifier');
const np = require('./');

const cli = meow(`
	Usage
	  $ np <version>

	  Version can be:
	    patch | minor | major | prepatch | preminor | premajor | prerelease | 1.2.3

	Options
	  --any-branch    Allow publishing from any branch
	  --skip-cleanup  Skips cleanup of node_modules
	  --yolo          Skips cleanup and testing
	  --tag           Publish under a given dist-tag

	Examples
	  $ np patch
	  $ np 1.0.2
	  $ np 1.0.2-beta.3 --tag=beta
`);

updateNotifier({pkg: cli.pkg}).notify();

if (cli.input.length === 0) {
	console.error('Specify a version\n\nExample: $ np patch');
	process.exit(1);
}

np(cli.input[0], cli.flags)
	.then(pkg => {
		console.log(`\n ${pkg.name} ${pkg.version} published`);
	})
	.catch(err => {
		console.error(`\n${err.message}`);
		process.exit(1);
	});
