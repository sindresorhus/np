import {execa} from 'execa';
import {deleteAsync} from 'del';
import hostedGitInfo from 'hosted-git-info';
import onetime from 'onetime';
import {asyncExitHook} from 'exit-hook';
import logSymbols from 'log-symbols';
// NOTE: We intentionally use our own task list instead of `listr` or `listr2`, so we control how the terminal is drawn, for example around prompts.
// listr2's DefaultRenderer uses log-update which had known issues with terminal scrolling that caused it to overwrite content printed before listr2 started (like our inquirer prompts). See: https://github.com/cenk1cenk2/listr2/issues/296
// log-update 8 cuts each frame to the terminal height, which fixes this. Our renderer then prints the final list in full, so it stays in the scrollback.
import {TaskList} from './task-list/index.js';
import prerequisiteTasks from './prerequisite-tasks.js';
import gitTasks from './git-tasks.js';
import {getPackagePublishArguments, runPublish} from './npm/publish.js';
import enable2fa, {getEnable2faArguments} from './npm/enable-2fa.js';
import handleNpmError from './npm/handle-npm-error.js';
import {getOidcProvider} from './npm/oidc.js';
import releaseTaskHelper from './release-task-helper.js';
import {findLockfile, printCommand} from './package-manager/index.js';
import * as util from './util.js';
import * as git from './git-util.js';
import * as npm from './npm/util.js';

/**
Executes a command and returns its output lines from both stdout and stderr, so a task shows the latest line. The iteration throws if the command fails.
@type {(command: string, arguments_: string[], options?: import('execa').Options) => AsyncIterable<string>}
*/
const exec = (command, arguments_, options) => execa(command, arguments_, {...options, all: true}).iterable({from: 'all'});

/**
Runs the np publish workflow.
@param {string} input - The version bump type or explicit version.
@param {import('./cli-implementation.js').Options} options - Configuration options for the publish workflow.
@param {{package_: import('read-pkg').NormalizedPackageJson; projectDirectory?: string; rootDirectory: string}} context - Project context including package data and directories.
*/
export default async function np(input = 'patch', {packageManager, ...rawOptions}, {package_, projectDirectory, rootDirectory}) {
	projectDirectory ??= rootDirectory;

	const {preview, ...options} = rawOptions;
	options.dryRun ??= preview;

	// TODO: Remove sometime far in the future
	if (options.skipCleanup) {
		options.cleanup = false;
	}

	const runTests = options.tests && !options.yolo;
	const runCleanup = options.cleanup && !options.yolo;
	const isRunInstall = !options.yolo;
	const lockfile = findLockfile(projectDirectory, packageManager);
	const isOnGitHub = options.repoUrl && hostedGitInfo.fromUrl(options.repoUrl)?.type === 'github';

	if (options.releaseDraftOnly) {
		if (!options.dryRun) {
			await releaseTaskHelper(options, package_, packageManager);
		}

		return package_;
	}

	const testScript = options.testScript || 'test';

	let publishStatus = 'UNKNOWN';
	let pushedObjects;
	// The OTP entered while publishing, which is also used to enable 2FA.
	let otp;

	const rollback = onetime(async () => {
		console.log('\nPublish failed. Rolling back to the previous state…');

		async function getPackageVersion() {
			const {package_: currentPackage} = await util.readPackage(rootDirectory);
			return currentPackage.version;
		}

		try {
			const tagVersionPrefix = await util.getTagVersionPrefix(packageManager);

			const latestTag = await git.latestTag();
			const versionInLatestTag = latestTag.slice(tagVersionPrefix.length);

			// Verify that the package's version has been bumped before deleting the last tag and commit.
			if (versionInLatestTag === await getPackageVersion() && versionInLatestTag !== package_.version) {
				await git.deleteTag(latestTag);
				await git.removeLastCommit();
			}

			console.log('Successfully rolled back the project to its previous state.');
			return true;
		} catch (error) {
			console.log(`Couldn't roll back because of the following error:\n${error}`);
			return false;
		}
	});

	asyncExitHook(async () => {
		if (options.dryRun || publishStatus === 'SUCCESS') {
			return;
		}

		if (publishStatus === 'FAILED') {
			await rollback();
		} else {
			console.log('\nAborted!');
		}
	}, {wait: 2000});

	// Don't enable 2FA when using OIDC (Trusted Publishing) as it's already managed
	const shouldEnable2FA = options['2fa'] && options.availability.isAvailable && !options.availability.isUnknown && !package_.private && !npm.isExternalRegistry(package_) && !getOidcProvider();

	// To prevent the process from hanging due to watch mode (e.g. when running `vitest`)
	const ciEnvOptions = {env: {CI: 'true'}};

	/**
	Returns the command array used to publish the package.
	@param {typeof options} _options - Options used to determine publish arguments.
	*/
	function getPublishCommand(_options) {
		const publishCommand = packageManager.publishCommand || (arguments_ => [packageManager.cli, arguments_]);
		const arguments_ = getPackagePublishArguments(_options);
		return publishCommand(arguments_);
	}

	// `--no-cleanup` only skips np's explicit cleanup task.
	// We still use the package manager's normal lockfile-aware install mode, even when that install mode replaces `node_modules` itself.
	const installCommand = lockfile ? packageManager.installCommand : packageManager.installCommandNoLockfile;

	const tasks = new TaskList([
		{
			title: 'Prerequisite check',
			enabled: options.runPublish,
			run: () => prerequisiteTasks(input, package_, options, {packageManager, rootDirectory}),
		},
		{
			title: 'Git',
			run: () => gitTasks(options),
		},
		{
			title: 'Cleanup',
			enabled: runCleanup && !lockfile,
			skip() {
				if (options.dryRun) {
					return '[Dry run] Command not executed: delete node_modules.';
				}
			},
			run: () => deleteAsync('node_modules', {cwd: projectDirectory}),
		},
		{
			title: `Installing dependencies using ${packageManager.id}`,
			enabled: isRunInstall,
			skip() {
				if (options.dryRun) {
					return `[Dry run] Command not executed: ${printCommand(installCommand)}.`;
				}
			},
			run: () => new TaskList([
				{
					title: 'Running install command',
					run: () => exec(...installCommand, {cwd: projectDirectory}),
				},
				{
					title: 'Checking working tree is still clean', // If lockfile was out of date and tracked by git, this will fail
					run: () => git.verifyWorkingTreeIsClean(),
				},
			]),
		},
		{
			title: 'Running tests',
			enabled: runTests,
			skip() {
				if (options.dryRun) {
					return `[Dry run] Command not executed: ${packageManager.cli} run ${testScript}.`;
				}
			},
			run: () => exec(packageManager.cli, ['run', testScript], {...ciEnvOptions, cwd: projectDirectory}),
		},
		{
			title: 'Bumping version',
			skip() {
				if (!options.dryRun) {
					return;
				}

				const [cli, arguments_] = packageManager.versionCommand(input);

				if (options.message) {
					arguments_.push('--message', options.message.replaceAll('%s', () => input));
				}

				return `[Dry run] Command not executed: ${printCommand([cli, arguments_])}`;
			},
			run() {
				const [cli, arguments_] = packageManager.versionCommand(input);

				if (options.message) {
					arguments_.push('--message', options.message);
				}

				// Inherit stdin to allow GPG password prompts for commit signing
				// Limitation: The task list keeps drawing during the command, so it can draw over a GPG prompt in the terminal. A graphical GPG prompt is not affected.
				return exec(cli, arguments_, {stdin: 'inherit'});
			},
		},
		...options.runPublish
			? [
				{
					title: options.stage ? 'Staging package' : 'Publishing package',
					skip() {
						if (!options.dryRun) {
							return;
						}

						const command = getPublishCommand(options);
						return `[Dry run] Command not executed: ${printCommand(command)}.`;
					},
					/**
					Runs the npm publish step and handles OTP prompts and errors.
					@type {(task: import('./task-list/index.js').Task) => Promise<void>}
					*/
					async run(task) {
						const publish = publishOptions => runPublish(getPublishCommand(publishOptions), {cwd: rootDirectory, task});

						try {
							await publish(options).catch(error => handleNpmError(error, task, enteredOtp => {
								otp = enteredOtp;

								return publish({...options, otp});
							}));
						} catch (error) {
							// Ctrl+C at the OTP prompt aborts, like Ctrl+C at any other prompt.
							if (error.name === 'ExitPromptError') {
								throw error;
							}

							publishStatus = 'FAILED';

							// The rollback prints its progress, so it must not be drawn over.
							const isRolledBack = await task.withTerminal(rollback);
							const rollbackMessage = isRolledBack ? '\n\nThe project was rolled back to its previous state.' : '';

							throw new Error(`Error publishing package:\n${error.message}${rollbackMessage}`, {cause: error});
						}

						publishStatus = 'SUCCESS';
					},
				},
				...shouldEnable2FA
					? [{
						title: 'Enabling two-factor authentication',
						async skip() {
							if (!options.dryRun) {
								return;
							}

							const arguments_ = await getEnable2faArguments(package_.name, options);
							return `[Dry run] Command not executed: npm ${arguments_.join(' ')}.`;
						},
						run: task => enable2fa(task, package_.name, {otp}),
					}]
					: [],
			]
			: [],
		{
			title: 'Pushing tags',
			async skip() {
				if (!options.remote && !(await git.hasUpstream())) {
					return 'Upstream branch not found; not pushing.';
				}

				if (options.dryRun) {
					const remote = options.remote ? `${options.remote} ` : '';
					return `[Dry run] Command not executed: git push ${remote}--follow-tags.`;
				}

				if (publishStatus === 'FAILED' && options.runPublish) {
					return 'Couldn\'t publish package to npm; not pushing.';
				}
			},
			async run() {
				pushedObjects = await git.pushGraceful(isOnGitHub, options.remote);
			},
		},
		...options.releaseDraft
			? [{
				title: 'Creating release draft on GitHub',
				enabled: isOnGitHub === true,
				skip() {
					if (options.dryRun) {
						return '[Dry run] GitHub Releases draft will not be opened in dry-run mode.';
					}
				},
				// It can print a message, which must not be drawn over.
				run: task => task.withTerminal(() => releaseTaskHelper(options, package_, packageManager)),
			}]
			: [],
	]);

	if (!options.runPublish) {
		publishStatus = 'SUCCESS';
	}

	await tasks.run({
		renderer: options.renderer,
		clearOnSuccess: !options.dryRun,
	});

	if (pushedObjects) {
		console.error(`\n${logSymbols.error} ${pushedObjects.reason}`);
	}

	const {package_: newPackage} = await util.readPackage(rootDirectory);
	return newPackage;
}
