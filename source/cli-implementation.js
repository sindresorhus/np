#!/usr/bin/env node
import path from 'node:path';
import process from 'node:process';
import logSymbols from 'log-symbols';
import meow from 'meow';
import semver from 'semver';
import updateNotifier from 'update-notifier';
import isInteractive from 'is-interactive';
import {execa} from 'execa';
import {gracefulExit} from 'exit-hook';
import {getPackageManagerConfig} from './package-manager/index.js';
import config from './config.js';
import * as util from './util.js';
import * as git from './git-util.js';
import * as npm from './npm/util.js';
import {verifyGitTasks} from './git-tasks.js';
import {getOidcProvider} from './npm/oidc.js';
import {getStageId} from './npm/publish.js';
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
	  --no-cleanup           Skips np's node_modules cleanup step before install
	  --no-tests             Skips tests
	  --yolo                 Skips cleanup and testing
	  --no-publish           Skips publishing
	  --dry-run              Show tasks without actually executing them
	  --tag                  Publish under a given dist-tag
	  --contents             Subdirectory to publish
	  --no-release-draft     Skips opening a GitHub release draft
	  --release-draft-only   Only opens a GitHub release draft for the latest published version
	  --no-release-notes     Skips generating release notes when opening a GitHub release draft
	  --test-script          Name of npm run script to run tests before publishing (default: test)
	  --no-2fa               Don't enable 2FA on new packages (not recommended)
	  --message              Version bump commit message, '%s' will be replaced with version (default: '%s' with npm and 'v%s' with yarn)
	  --package-manager      Use a specific package manager (default: package.json packageManager/devEngines)
	  --provenance           Publish with npm provenance statements (CI-only)
	  --remote               Git remote to push to (default: origin)
	  --stage                Stage the publish for later approval (npm and pnpm only)

	Examples
	  $ np
	  $ np patch
	  $ np 1.0.2
	  $ np 1.0.2-beta.3 --tag=beta
	  $ np 1.0.2-beta.3 --tag=beta --contents=dist
`, {
	importMeta: import.meta,
	booleanDefault: undefined,
	allowUnknownFlags: false,
	// Don't use `default` for flags - we apply defaults later so config can override them
	flags: {
		anyBranch: {
			type: 'boolean',
		},
		branch: {
			type: 'string',
		},
		cleanup: {
			type: 'boolean',
		},
		tests: {
			type: 'boolean',
		},
		yolo: {
			type: 'boolean',
		},
		publish: {
			type: 'boolean',
		},
		releaseDraft: {
			type: 'boolean',
		},
		releaseDraftOnly: {
			type: 'boolean',
		},
		releaseNotes: {
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
		dryRun: {
			type: 'boolean',
			aliases: ['preview'],
		},
		testScript: {
			type: 'string',
		},
		'2fa': {
			type: 'boolean',
		},
		message: {
			type: 'string',
		},
		provenance: {
			type: 'boolean',
		},
		remote: {
			type: 'string',
		},
		stage: {
			type: 'boolean',
		},
	},
});

updateNotifier({pkg: cli.pkg}).notify();

/** @typedef {Awaited<ReturnType<typeof getOptions>>['options']} Options */

async function getOptions() {
	const initialConfig = await config(process.cwd());
	const contents = cli.flags.contents ?? initialConfig?.contents;
	const packagePath = contents ? path.resolve(process.cwd(), contents) : process.cwd();

	const {package_, rootDirectory} = await util.readPackage(packagePath);
	const projectDirectory = contents ? process.cwd() : rootDirectory;

	const localConfig = projectDirectory === process.cwd()
		? initialConfig
		: await config(projectDirectory);

	// Filter out undefined CLI flags (not provided by user)
	const explicitCliFlags = Object.fromEntries(Object.entries(cli.flags).filter(([, value]) => value !== undefined));

	// Merge: local config → explicit CLI flags → defaults
	const mergedFlags = {
		cleanup: true,
		tests: true,
		publish: true,
		releaseDraft: true,
		releaseNotes: true,
		'2fa': true,
		...localConfig,
		...explicitCliFlags,
	};

	const {preview, ...flags} = mergedFlags;
	flags.dryRun ??= preview;

	// Workaround for unintended auto-casing behavior from `meow`.
	if ('2Fa' in flags) {
		flags['2fa'] = flags['2Fa'];
	}

	if (flags.packageManager) {
		package_.packageManager = flags.packageManager;
	}

	const packageManager = getPackageManagerConfig(projectDirectory, package_);

	if (packageManager.throwOnExternalRegistry && npm.isExternalRegistry(package_)) {
		throw new Error(`External registry is not yet supported with ${packageManager.id}.`);
	}

	const runPublish = !flags.releaseDraftOnly && flags.publish && !package_.private;

	const availability = runPublish
		? await npm.isPackageNameAvailable(package_)
		: {
			isAvailable: false,
			isUnknown: false,
		};

	if (flags.stage) {
		if (!['npm', 'pnpm'].includes(packageManager.id)) {
			throw new Error(`Staged publishing is only supported with npm and pnpm, not ${packageManager.id}.`);
		}

		const minimumVersion = {
			npm: '11.15.0',
			pnpm: '11.3.0',
		}[packageManager.id];
		const {stdout: packageManagerVersion} = await execa(packageManager.cli, ['--version']);
		if (!semver.valid(packageManagerVersion) || semver.lt(packageManagerVersion, minimumVersion)) {
			throw new Error(`Staged publishing requires ${packageManager.id} >=${minimumVersion}. Please upgrade ${packageManager.cli} and try again.`);
		}

		if (availability.isAvailable) {
			throw new Error('Staged publishing requires the package to already exist on the registry. Publish the first version normally, then use `--stage`.');
		}
	}

	// Use current (latest) version when 'releaseDraftOnly', otherwise try to use the first argument.
	const version = flags.releaseDraftOnly ? package_.version : cli.input.at(0);

	const branch = flags.branch ?? await git.defaultBranch();
	if (!flags.releaseDraftOnly) {
		// Keep obvious Git failures ahead of the wizard, but do not replace the later Git task.
		// The publish flow still needs a final check in case the repo changes while the user is prompting or logging in.
		await verifyGitTasks({anyBranch: flags.anyBranch, branch, remote: flags.remote});
	}

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
		projectDirectory,
		rootDirectory,
		package_,
	};
}

const ensureAuthenticated = async package_ => {
	// Skip auth check if OIDC is available (will be handled by npm publish itself)
	if (getOidcProvider()) {
		console.log('OIDC authentication detected - skipping auth check');
		return;
	}

	// Use the exact publish registry (if any) so this check can't disagree with the prerequisite auth check. See #764.
	const externalRegistry = package_.publishConfig?.registry;

	try {
		await npm.username({externalRegistry});
		return;
	} catch (error) {
		if (!error.isNotLoggedIn || !isInteractive()) {
			throw error;
		}
	}

	console.log('\nYou must be logged in to publish. Running `npm login`...\n');
	await npm.login({externalRegistry});

	// `npm login` writes a fresh session token to the user `.npmrc`, but a project-level `.npmrc` with a stale or revoked token takes precedence and keeps `npm whoami` failing. Re-verify so we fail with a clear reason instead of looping on the generic prerequisite-task error.
	try {
		await npm.username({externalRegistry});
	} catch (error) {
		// Only the still-not-logged-in case points to the stale-token cause; surface other errors (e.g. a network timeout) as-is.
		if (!error.isNotLoggedIn) {
			throw error;
		}

		throw new Error('Still not authenticated after `npm login`. A project-level `.npmrc` may hold a stale or revoked token that overrides your login. Check it for outdated `_authToken` entries.', {cause: error});
	}
};

try {
	const {options, projectDirectory, rootDirectory, package_} = await getOptions();

	if (!options.confirm) {
		gracefulExit();
	}

	// Check authentication early, before Listr starts (so login can be interactive)
	if (options.runPublish) {
		await ensureAuthenticated(package_);
	}

	console.log(); // Prints a newline for readability
	const newPackage = await np(options.version.toString(), options, {package_, projectDirectory, rootDirectory});

	if (options.dryRun || options.releaseDraftOnly) {
		gracefulExit();
	}

	if (options.stage && options.runPublish) {
		const {cli: packageManagerCli} = options.packageManager;
		const stageId = await getStageId(options.packageManager, {name: newPackage.name, version: newPackage.version, cwd: rootDirectory});
		const approveInstructions = stageId
			? `  ${packageManagerCli} stage approve ${stageId}`
			: `  ${packageManagerCli} stage list             # find the stage-id\n  ${packageManagerCli} stage approve <stage-id>`;
		console.log(`\n ${newPackage.name} ${newPackage.version} staged 📦\n\nApprove it to go live (requires 2FA):\n${approveInstructions}\n\nYou can also approve at https://www.npmjs.com`);
	} else {
		console.log(`\n ${newPackage.name} ${newPackage.version} published 🎉`);
	}
} catch (error) {
	if (error.name === 'ExitPromptError') {
		process.exit(0);
	}

	console.error(`\n${logSymbols.error} ${error?.stack ?? error}`);
	gracefulExit(1);
}
