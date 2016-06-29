#!/usr/bin/env node
'use strict';
const meow = require('meow');
const updateNotifier = require('update-notifier');
const np = require('./');

const cli = meow(`
	Usage
	  $ np [major | minor | patch | premajor | preminor | prepatch | prerelease | <version>] (Default: patch)

	Options
	  --any-branch    Allow publishing from any branch
	  --skip-cleanup  Skips cleanup of node_modules
	  --yolo          Skips cleanup and testing

	Examples
	  $ np
	  $ np patch
	  $ np 1.0.2
`);

updateNotifier({pkg: cli.pkg}).notify();

Promise.resolve()
	.then(() => np(cli.input[0], cli.flags))
	.catch(err => {
		console.error(`\n${err.message}`);
		process.exit(1);
	});
