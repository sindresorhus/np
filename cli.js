#!/usr/bin/env node
'use strict';
const meow = require('meow');
const logSymbols = require('log-symbols');
const np = require('./');

const cli = meow(`
	Usage
	  $ np [major | minor | patch | premajor | preminor | prepatch | prerelease | <version>] (Default: patch)

	Example
	  $ np
	  $ np patch
	  $ np 1.0.2
`);

try {
	np(cli.input[0]);
} catch (err) {
	console.error(` ${logSymbols.error} ${err.message}`);
	process.exit(1);
}
