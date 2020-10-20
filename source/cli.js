#!/usr/bin/env node
'use strict';
const util = require('util');
const importLocal = require('import-local');
const isInstalledGlobally = require('is-installed-globally');

const debuglog = util.debuglog('np');

// Prefer the local installation
if (!importLocal(__filename)) {
	if (isInstalledGlobally) {
		debuglog('Using global install of np.');
	}

	// eslint-disable-next-line import/no-unassigned-import
	require('./cli-implementation');
}
