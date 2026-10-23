#!/usr/bin/env node
import path from 'node:path';
import process from 'node:process';
import logSymbols from 'log-symbols';
import meow from 'meow';
import semver from 'semver';
import updateNotifier from 'update-notifier';
import isInteractive from 'is-interactive';
import inquirer from 'inquirer';
import {execa} from 'execa';
import {gracefulExit} from 'exit-hook';
import {packageDirectory} from 'package-directory';
import {PresentableError, isPresentableError} from 'presentable-error';
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

	Commands
	  release-draft          Open a prefilled GitHub release form for the latest Git tag

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
	  $ np release-draft
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

// Meow only handles these flags when they are the only argument, so `np release-draft --help` would otherwise run the command.
if (cli.flags.help) {
	cli.showHelp(0);
}

if (cli.flags.version) {
	cli.showVersion();
}

updateNotifier({pkg: cli.pkg}).notify();

/** @typedef {NonNullable<Awaited<ReturnType<typeof getOptions>>>['options']} Options */

/**
Restarts the command after a Git update so executable config and memoized lookups reflect the working tree.
@param {string[]} [extraArguments] - Arguments to append to the original command.
*/
const restart = async (extraArguments = []) => {
	// Ctrl+C also reaches the restarted command, which handles it. Exiting first would return the shell prompt while it still runs its exit hooks.
	const ignoreSignal = () => {};
	process.on('SIGINT', ignoreSignal);
	try {
		const {exitCode} = await execa(process.execPath, [...process.execArgv, ...process.argv.slice(1), ...extraArguments], {stdio: 'inherit', reject: false});
		gracefulExit(exitCode ?? 1);
	} finally {
		process.off('SIGINT', ignoreSignal);
	}
};

/**
Resolves the release branch before loading package data. Switching restarts the command so executable config and memoized lookups come from the selected branch. Returns undefined when the current process should stop.
@param {CLI['flags']} flags - Invocation flags, updated when continuing from the current branch.
*/
const prepareReleaseBranch = async flags => {
	const branch = flags.branch ?? (flags.anyBranch ? 'HEAD' : await git.defaultBranch());
	if (flags.anyBranch || flags.dryRun || !isInteractive()) {
		return branch;
	}

	const currentBranch = await git.getCurrentBranch();
	if (currentBranch === branch || !(await git.hasLocalBranch(branch))) {
		return branch;
	}

	await git.verifyWorkingTreeIsClean();
	const currentBranchLabel = currentBranch.replaceAll(/\p{Control}/gv, '');
	const releaseBranchLabel = branch.replaceAll(/\p{Control}/gv, '');
	const {action} = await inquirer.prompt({
		action: {
			type: 'select',
			message: `You’re on “${currentBranchLabel}”, but the release branch is “${releaseBranchLabel}”.`,
			choices: [
				{name: `Switch to “${releaseBranchLabel}” and continue`, value: 'switch'},
				{name: `Continue releasing from “${currentBranchLabel}”`, value: 'current'},
				{name: 'Cancel', value: 'cancel'},
			],
		},
	});

	if (action === 'current') {
		flags.anyBranch = true;
		return 'HEAD';
	}

	if (action === 'switch') {
		await execa('git', ['checkout', branch, '--']);
		await restart();
		return;
	}

	gracefulExit();
};

/**
Checks Git before loading package data and offers to fast-forward a branch that is only behind its upstream. Returns whether the current process should continue.
@param {CLI['flags']} flags - Invocation flags.
@param {string} branch - The release branch.
*/
const prepareGit = async (flags, branch) => {
	try {
		await verifyGitTasks({anyBranch: flags.anyBranch, branch, remote: flags.remote});
		return true;
	} catch (error) {
		if (!error.isBehind || flags.dryRun || !isInteractive()) {
			throw error;
		}
	}

	const {action} = await inquirer.prompt({
		action: {
			type: 'select',
			message: 'Your branch is behind its upstream.',
			choices: [
				{name: 'Update branch and continue', value: 'update'},
				{name: 'Cancel', value: 'cancel'},
			],
		},
	});

	if (action === 'update') {
		await git.verifyWorkingTreeIsClean();
		await execa('git', ['merge', '--ff-only', '@{u}'], {stdio: 'inherit'});
		// Keep a choice to continue from the current branch, so the restarted command does not ask again.
		await restart(flags.anyBranch ? ['--any-branch'] : []);
	} else {
		gracefulExit();
	}

	return false;
};

// These lookups are memoized, each spawns a process, and the prompts and the auth check need them later. Starting them now overlaps that work with the registry availability lookup. Failures are ignored here because the real calls report them.
const warmUpPublishLookups = async (package_, packageManager, rootDirectory) => {
	try {
		await Promise.all([
			npm.getFilesToBePacked(rootDirectory),
			// The auth check is skipped with OIDC, so don't warm it up either.
			getOidcProvider() ? undefined : npm.username({externalRegistry: package_.publishConfig?.registry}),
			util.getPreReleasePrefix(packageManager),
		]);
	} catch {}
};

async function getOptions() {
	const workingDirectory = process.cwd();
	const foundProjectDirectory = await packageDirectory({cwd: workingDirectory});
	const projectDirectory = foundProjectDirectory ?? workingDirectory;
	const localConfig = await config(projectDirectory);
	// TODO: Remove this migration error and the old flag definition in a future major release.
	if (cli.flags.releaseDraftOnly !== undefined || localConfig?.releaseDraftOnly !== undefined) {
		throw new PresentableError('The `--release-draft-only` flag has been replaced by `np release-draft`. Remove `releaseDraftOnly` from your np config if set.');
	}

	// Filter out undefined CLI flags (not provided by user)
	const explicitCliFlags = Object.fromEntries(Object.entries(cli.flags).filter(([, value]) => value !== undefined));

	// Merge: defaults → local config → explicit CLI flags
	const mergedFlags = {
		cleanup: true,
		tests: true,
		publish: true,
		releaseDraft: true,
		releaseNotes: true,
		'2fa': true,
		...localConfig,
		...explicitCliFlags,
		releaseDraftOnly: cli.input.at(0) === 'release-draft',
	};

	const {preview, ...flags} = mergedFlags;
	flags.dryRun ??= preview;

	// Workaround for unintended auto-casing behavior from `meow`.
	if ('2Fa' in flags) {
		flags['2fa'] = flags['2Fa'];
	}

	let branch;
	if (!flags.releaseDraftOnly) {
		branch = await prepareReleaseBranch(flags);

		// Keep obvious Git failures ahead of the wizard, but do not replace the later Git task.
		// The publish flow still needs a final check in case the repo changes while the user is prompting or logging in.
		if (branch === undefined || !(await prepareGit(flags, branch))) {
			return;
		}
	}

	const {contents} = flags;
	// Configured contents are relative to the project; explicit CLI paths are relative to the invocation directory.
	const packagePath = contents ? path.resolve(cli.flags.contents === undefined ? projectDirectory : workingDirectory, contents) : projectDirectory;

	const {package_, rootDirectory} = await util.readPackage(packagePath);
	if (contents && rootDirectory !== packagePath) {
		throw new PresentableError(`No \`package.json\` found in the contents directory: ${packagePath}`);
	}

	const {package_: projectPackage} = foundProjectDirectory && foundProjectDirectory !== rootDirectory
		? await util.readPackage(foundProjectDirectory)
		: {package_};
	if (flags.packageManager) {
		projectPackage.packageManager = flags.packageManager;
	}

	const packageManager = getPackageManagerConfig(projectDirectory, projectPackage);

	if (flags.releaseDraftOnly) {
		const options = await ui({
			...flags,
			packageManager,
			runPublish: false,
			version: package_.version,
		}, {package_, rootDirectory});

		return {
			options: {...options, packageManager},
			projectDirectory,
			rootDirectory,
			package_,
		};
	}

	if (packageManager.throwOnExternalRegistry && npm.isExternalRegistry(package_)) {
		throw new PresentableError(`External registry is not yet supported with ${packageManager.id}.`);
	}

	const runPublish = flags.publish && !package_.private;
	if (runPublish && flags.provenance && packageManager.cli === 'yarn') {
		const {stdout: yarnVersion} = await execa(packageManager.cli, ['--version']);
		if (!semver.valid(yarnVersion) || semver.lt(yarnVersion, '4.9.0')) {
			throw new PresentableError('Publishing with provenance requires Yarn 4.9.0 or later. Please upgrade Yarn or disable provenance.');
		}
	}

	// Start the registry lookup now so it overlaps with the publish lookup warm-up below.
	const availabilityPromise = runPublish
		? npm.isPackageNameAvailable(package_)
		: Promise.resolve({
			isAvailable: false,
			isUnknown: false,
		});

	if (runPublish) {
		warmUpPublishLookups(package_, packageManager, rootDirectory);
	}

	const availability = await availabilityPromise;

	if (flags.stage) {
		if (!['npm', 'pnpm'].includes(packageManager.id)) {
			throw new PresentableError(`Staged publishing is only supported with npm and pnpm, not ${packageManager.id}.`);
		}

		const minimumVersion = {
			npm: '11.15.0',
			pnpm: '11.3.0',
		}[packageManager.id];
		const {stdout: packageManagerVersion} = await execa(packageManager.cli, ['--version']);
		if (!semver.valid(packageManagerVersion) || semver.lt(packageManagerVersion, minimumVersion)) {
			throw new PresentableError(`Staged publishing requires ${packageManager.id} >=${minimumVersion}. Please upgrade ${packageManager.cli} and try again.`);
		}

		if (availability.isAvailable) {
			throw new PresentableError('Staged publishing requires the package to already exist on the registry. Publish the first version normally, then use `--stage`.');
		}
	}

	// Use the first argument as the version for the publish flow.
	const version = cli.input.at(0);

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

		throw new PresentableError('Still not authenticated after `npm login`. A project-level `.npmrc` may hold a stale or revoked token that overrides your login. Check it for outdated `_authToken` entries.', {cause: error});
	}
};

const run = async () => {
	const context = await getOptions();
	if (!context) {
		return;
	}

	const {options, projectDirectory, rootDirectory, package_} = context;

	if (!options.confirm) {
		gracefulExit();
		return;
	}

	// Check authentication before an actual publish, so login can be interactive.
	if (options.runPublish && !options.dryRun) {
		await ensureAuthenticated(package_);
	}

	console.log(); // Prints a newline for readability
	const newPackage = await np(options.version.toString(), options, {package_, projectDirectory, rootDirectory});

	if (options.dryRun || options.releaseDraftOnly) {
		gracefulExit();
		return;
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
};

try {
	await run();
} catch (error) {
	if (error?.name === 'ExitPromptError') {
		// Run the exit hooks, so np can print that it was aborted. Exit with 130 like for SIGINT, as the prompt was canceled with Ctrl+C.
		gracefulExit(130);
	} else {
		// Presentable errors explain why np stopped, so the stack is just noise. Other errors are likely bugs, so keep the stack for debugging.
		const message = isPresentableError(error) ? error.message : (error?.stack ?? error);
		console.error(`\n${logSymbols.error} ${message}`);
		gracefulExit(1);
	}
}
