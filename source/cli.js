#!/usr/bin/env node
'use strict';
const {debuglog} = require('util');
const importLocal = require('import-local');
const isInstalledGlobally = require('is-installed-globally');

const log = debuglog('np');

// Prefer the local installation
if (!importLocal(__filename)) {
	if (isInstalledGlobally) {
		log('Using global install of np.');
	}

	// eslint-disable-next-line import/no-unassigned-import
	require('./cli-implementation');
}
