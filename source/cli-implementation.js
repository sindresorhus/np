#!/usr/bin/env node
// eslint-disable-next-line import/no-unassigned-import
import 'symbol-observable'; // Important: This needs to be first to prevent weird Observable incompatibilities
import logSymbols from 'log-symbols';
import meow from 'meow';
import updateNotifier from 'update-notifier';
import {gracefulExit} from 'exit-hook';
import {getPackageManagerConfig} from './package-manager/index.js';
import config from './config.js';
import * as util from './util.js';
import * as git from './git-util.js';
import * as npm from './npm/util.js';
import {SEMVER_INCREMENTS} from './version.js';
import ui from './ui.js';
import np from './index.js';

/** @typedef {typeof cli} CLI */

const cli = meow(`
	Usage
	  $ np <version>

	  Version can be:
	    ${SEMVER_INCREMENTS.join(' | ')} | 1.2.3

	Options
	  --any-branch           Allow publishing from any branch
	  --branch               Name of the release branch (default: main | master)
	  --no-cleanup           Skips cleanup of node_modules
	  --no-tests             Skips tests
	  --yolo                 Skips cleanup and testing
	  --no-publish           Skips publishing
	  --preview              Show tasks without actually executing them
	  --tag                  Publish under a given dist-tag
	  --contents             Subdirectory to publish
	  --no-release-draft     Skips opening a GitHub release draft
	  --release-draft-only   Only opens a GitHub release draft for the latest published version
	  --test-script          Name of npm run script to run tests before publishing (default: test)
	  --no-2fa               Don't enable 2FA on new packages (not recommended)
	  --message              Version bump commit message, '%s' will be replaced with version (default: '%s' with npm and 'v%s' with yarn)
	  --package-manager      Use a specific package manager (default: 'packageManager' field in package.json)

	Examples
	  $ np
	  $ np patch
	  $ np 1.0.2
	  $ np 1.0.2-beta.3 --tag=beta
	  $ np 1.0.2-beta.3 --tag=beta --contents=dist
`, {
	importMeta: import.meta,
	booleanDefault: undefined,
	flags: {
		anyBranch: {
			type: 'boolean',
		},
		branch: {
			type: 'string',
		},
		cleanup: {
			type: 'boolean',
			default: true,
		},
		tests: {
			type: 'boolean',
			default: true,
		},
		yolo: {
			type: 'boolean',
		},
		publish: {
			type: 'boolean',
			default: true,
		},
		releaseDraft: {
			type: 'boolean',
			default: true,
		},
		releaseDraftOnly: {
			type: 'boolean',
		},
		tag: {
			type: 'string',
		},
		packageManager: {
			type: 'string',
		},
		contents: {
			type: 'string',
		},
		preview: {
			type: 'boolean',
		},
		testScript: {
			type: 'string',
		},
		'2fa': {
			type: 'boolean',
			default: true,
		},
		message: {
			type: 'string',
		},
	},
});

updateNotifier({pkg: cli.pkg}).notify();

/** @typedef {Awaited<ReturnType<typeof getOptions>>['options']} Options */

async function getOptions() {
	const {package_, rootDirectory} = await util.readPackage(cli.flags.contents);

	const localConfig = await config(rootDirectory);
	const flags = {
		...localConfig,
		...cli.flags,
	};

	// Workaround for unintended auto-casing behavior from `meow`.
	if ('2Fa' in flags) {
		flags['2fa'] = flags['2Fa'];
	}

	if (flags.packageManager) {
		package_.packageManager = flags.packageManager;
	}

	const packageManager = getPackageManagerConfig(rootDirectory, package_);

	if (packageManager.throwOnExternalRegistry && npm.isExternalRegistry(package_)) {
		throw new Error(`External registry is not yet supported with ${packageManager.id}.`);
	}

	const runPublish = !flags.releaseDraftOnly && flags.publish && !package_.private;

	const availability = runPublish ? await npm.isPackageNameAvailable(package_) : {
		isAvailable: false,
		isUnknown: false,
	};

	// Use current (latest) version when 'releaseDraftOnly', otherwise try to use the first argument.
	const version = flags.releaseDraftOnly ? package_.version : cli.input.at(0);

	const branch = flags.branch ?? await git.defaultBranch();

	const options = await ui({
		...flags,
		packageManager,
		runPublish,
		availability,
		version,
		branch,
	}, {package_, rootDirectory});

	return {
		options: {...options, packageManager},
		rootDirectory,
		package_,
	};
}

try {
	const {options, rootDirectory, package_} = await getOptions();

	if (!options.confirm) {
		gracefulExit();
	}

	console.log(); // Prints a newline for readability
	const newPackage = await np(options.version, options, {package_, rootDirectory});

	if (options.preview || options.releaseDraftOnly) {
		gracefulExit();
	}

	console.log(`\n ${newPackage.name} ${newPackage.version} published 🎉`);
} catch (error) {
	console.error(`\n${logSymbols.error} ${error?.stack ?? error}`);
	gracefulExit(1);
}
