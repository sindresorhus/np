#!/usr/bin/env node
'use strict';
const importLocal = require('import-local');
const isInstalledGlobally = require('is-installed-globally');

// Prefer the local installation
if (!(importLocal(__filename))) {
	if (isInstalledGlobally) {
		console.log('Using global install of np.');
	}
	require('./cli-implementation');
}
