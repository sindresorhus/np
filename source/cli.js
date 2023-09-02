#!/usr/bin/env node
import {debuglog} from 'node:util';
import importLocal from 'import-local';
import isInstalledGlobally from 'is-installed-globally';

const log = debuglog('np');

// Prefer the local installation
if (!importLocal(import.meta.url)) {
	if (isInstalledGlobally) {
		log('Using global install of np.');
	}

	await import('./cli-implementation.js');
}
