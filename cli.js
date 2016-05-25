#!/usr/bin/env node
'use strict';
var meow = require('meow');
var logSymbols = require('log-symbols');
var np = require('./');

var cli = meow(`
	Usage
	  $ np [patch | minor | major | <version>]

	Example
	  $ np patch
`);

try {
	np(cli.input[0]);
} catch (err) {
	console.log(' ' + logSymbols.error + ' ' + err.message);
}
