#!/usr/bin/env node
'use strict';
// eslint-disable-next-line import/no-unassigned-import
require('symbol-observable'); // Important: This needs to be first to prevent weird Observable incompatibilities
const logSymbols = require('log-symbols');
const meow = require('meow');
const updateNotifier = require('update-notifier');
const hasYarn = require('has-yarn');
const config = require('./config');
const git = require('./git-util');
const {isPackageNameAvailable} = require('./npm/util');
const version = require('./version');
const util = require('./util');
const ui = require('./ui');
const np = require('.');

const cli = meow(`
	Usage
	  $ np <version>

	  Version can be:
	    ${version.SEMVER_INCREMENTS.join(' | ')} | 1.2.3

	Options
	  --any-branch           Allow publishing from any branch
	  --branch               Name of the release branch (default: main | master)
	  --no-cleanup           Skips cleanup of node_modules
	  --no-tests             Skips tests
	  --yolo                 Skips cleanup and testing
	  --no-publish           Skips publishing
	  --preview              Show tasks without actually executing them
	  --tag                  Publish under a given dist-tag
	  --no-yarn              Don't use Yarn
	  --contents             Subdirectory to publish
	  --no-release-draft     Skips opening a GitHub release draft
	  --release-draft-only   Only opens a GitHub release draft for the latest published version
	  --test-script          Name of npm run script to run tests before publishing (default: test)
	  --no-2fa               Don't enable 2FA on new packages (not recommended)
	  --message              Version bump commit message, '%s' will be replaced with version (default: '%s' with npm and 'v%s' with yarn)

	Examples
	  $ np
	  $ np patch
	  $ np 1.0.2
	  $ np 1.0.2-beta.3 --tag=beta
	  $ np 1.0.2-beta.3 --tag=beta --contents=dist
`, {
	booleanDefault: undefined,
	flags: {
		anyBranch: {
			type: 'boolean'
		},
		branch: {
			type: 'string'
		},
		cleanup: {
			type: 'boolean'
		},
		tests: {
			type: 'boolean'
		},
		yolo: {
			type: 'boolean'
		},
		publish: {
			type: 'boolean'
		},
		releaseDraft: {
			type: 'boolean'
		},
		releaseDraftOnly: {
			type: 'boolean'
		},
		tag: {
			type: 'string'
		},
		yarn: {
			type: 'boolean'
		},
		contents: {
			type: 'string'
		},
		preview: {
			type: 'boolean'
		},
		testScript: {
			type: 'string'
		},
		'2fa': {
			type: 'boolean'
		},
		message: {
			type: 'string'
		}
	}
});

updateNotifier({pkg: cli.pkg}).notify();

(async () => {
	const pkg = util.readPkg();

	const defaultFlags = {
		cleanup: true,
		tests: true,
		publish: true,
		releaseDraft: true,
		yarn: hasYarn(),
		'2fa': true
	};

	const localConfig = await config();

	const flags = {
		...defaultFlags,
		...localConfig,
		...cli.flags
	};

	// Workaround for unintended auto-casing behavior from `meow`.
	if ('2Fa' in flags) {
		flags['2fa'] = flags['2Fa'];
	}

	const runPublish = !flags.releaseDraftOnly && flags.publish && !pkg.private;

	const availability = flags.publish ? await isPackageNameAvailable(pkg) : {
		isAvailable: false,
		isUnknown: false
	};

	// Use current (latest) version when 'releaseDraftOnly', otherwise use the first argument.
	const version = flags.releaseDraftOnly ? pkg.version : (cli.input.length > 0 ? cli.input[0] : false);

	const branch = flags.branch || await git.defaultBranch();
	const options = await ui({
		...flags,
		availability,
		version,
		runPublish,
		branch
	}, pkg);

	if (!options.confirm) {
		process.exit(0);
	}

	console.log(); // Prints a newline for readability
	const newPkg = await np(options.version, options);

	if (options.preview || options.releaseDraftOnly) {
		return;
	}

	console.log(`\n ${newPkg.name} ${newPkg.version} published 🎉`);
})().catch(error => {
	console.error(`\n${logSymbols.error} ${error.message}`);
	process.exit(1);
});
