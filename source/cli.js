#!/usr/bin/env node
import {fileURLToPath} from 'node:url';
import {debuglog} from 'node:util';
import importLocal from 'import-local';
import isInstalledGlobally from 'is-installed-globally';

const __filename = fileURLToPath(import.meta.url);
const log = debuglog('np');

// Prefer the local installation
if (!importLocal(__filename)) {
	if (isInstalledGlobally) {
		log('Using global install of np.');
	}

	await import('./cli-implementation.js');
}
