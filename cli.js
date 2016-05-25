#!/usr/bin/env node
'use strict';
const meow = require('meow');
const logSymbols = require('log-symbols');
const np = require('./');

const cli = meow(`
	Usage
	  $ np [patch | minor | major | <version>] (Default: patch)

	Example
	  $ np patch
`);

try {
	np(cli.input[0]);
} catch (err) {
	console.log(` ${logSymbols.error} ${err.message}`);
}
