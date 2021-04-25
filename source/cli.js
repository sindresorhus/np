#!/usr/bin/env node
import {debuglog} from 'util';
import importLocal from 'import-local';
import isInstalledGlobally from 'is-installed-globally';
import './cli-implementation';

const log = debuglog('np');
// Prefer the local installation
if (!importLocal(__filename)) {
	if (isInstalledGlobally) {
		log('Using global install of np.');
	}
}
