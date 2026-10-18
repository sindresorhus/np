#!/usr/bin/env node
import {debuglog} from 'node:util';
import {createRequire} from 'node:module';
import process from 'node:process';
import {pathToFileURL} from 'node:url';
import isInstalledGlobally from 'is-installed-globally';

const log = debuglog('np');

// Prefer the local installation
let localCli;
try {
	localCli = createRequire(import.meta.url).resolve('np/source/cli.js', {paths: [process.cwd()]});
} catch {}

if (localCli && localCli !== import.meta.filename) {
	await import(pathToFileURL(localCli));
} else {
	if (isInstalledGlobally) {
		log('Using global install of np.');
	}

	await import('./cli-implementation.js');
}
