import {execa} from 'execa';
import {deleteAsync} from 'del';
import Listr from 'listr';
import {
	merge,
	catchError,
	filter,
	finalize,
	from,
} from 'rxjs';
import hostedGitInfo from 'hosted-git-info';
import onetime from 'onetime';
import {asyncExitHook} from 'exit-hook';
import logSymbols from 'log-symbols';
import prerequisiteTasks from './prerequisite-tasks.js';
import gitTasks from './git-tasks.js';
import {getPackagePublishArguments, runPublish} from './npm/publish.js';
import enable2fa, {getEnable2faArguments} from './npm/enable-2fa.js';
import handleNpmError from './npm/handle-npm-error.js';
import releaseTaskHelper from './release-task-helper.js';
import {findLockfile, printCommand} from './package-manager/index.js';
import * as util from './util.js';
import * as git from './git-util.js';
import * as npm from './npm/util.js';

/** @type {(cmd: string, args: string[], options?: import('execa').Options) => any} */
const exec = (command, arguments_, options) => {
	// Use `Observable` support if merged https://github.com/sindresorhus/execa/pull/26
	const subProcess = execa(command, arguments_, options);

	return merge(subProcess.stdout, subProcess.stderr, subProcess).pipe(filter(Boolean));
};

/**
@param {string} input
@param {import('./cli-implementation.js').Options} options
@param {{package_: import('read-pkg').NormalizedPackageJson; rootDirectory: string}} context
*/
const np = async (input = 'patch', {packageManager, ...options}, {package_, rootDirectory}) => {
	// TODO: Remove sometime far in the future
	if (options.skipCleanup) {
		options.cleanup = false;
	}

	const runTests = options.tests && !options.yolo;
	const runCleanup = options.cleanup && !options.yolo;
	const lockfile = findLockfile(rootDirectory, packageManager);
	const isOnGitHub = options.repoUrl && hostedGitInfo.fromUrl(options.repoUrl)?.type === 'github';
	const testScript = options.testScript || 'test';

	if (options.releaseDraftOnly) {
		await releaseTaskHelper(options, package_, packageManager);
		return package_;
	}

	let publishStatus = 'UNKNOWN';
	let pushedObjects;

	const rollback = onetime(async () => {
		console.log('\nPublish failed. Rolling back to the previous state…');

		const tagVersionPrefix = await util.getTagVersionPrefix(packageManager);

		const latestTag = await git.latestTag();
		const versionInLatestTag = latestTag.slice(tagVersionPrefix.length);

		async function getPackageVersion() {
			const package_ = await util.readPackage(rootDirectory);
			return package_.version;
		}

		try {
			// Verify that the package's version has been bumped before deleting the last tag and commit.
			if (versionInLatestTag === await getPackageVersion() && versionInLatestTag !== package_.version) {
				await git.deleteTag(latestTag);
				await git.removeLastCommit();
			}

			console.log('Successfully rolled back the project to its previous state.');
		} catch (error) {
			console.log(`Couldn't roll back because of the following error:\n${error}`);
		}
	});

	asyncExitHook(async () => {
		if (options.preview || publishStatus === 'SUCCESS') {
			return;
		}

		if (publishStatus === 'FAILED') {
			await rollback();
		} else {
			console.log('\nAborted!');
		}
	}, {wait: 2000});

	const shouldEnable2FA = options['2fa'] && options.availability.isAvailable && !options.availability.isUnknown && !package_.private && !npm.isExternalRegistry(package_);

	// To prevent the process from hanging due to watch mode (e.g. when running `vitest`)
	const ciEnvOptions = {env: {CI: 'true'}};

	/** @param {typeof options} _options */
	function getPublishCommand(_options) {
		const publishCommand = packageManager.publishCommand || (arguments_ => [packageManager.cli, arguments_]);
		const arguments_ = getPackagePublishArguments(_options);
		return publishCommand(arguments_);
	}

	const tasks = new Listr([
		{
			title: 'Prerequisite check',
			enabled: () => options.runPublish,
			task: () => prerequisiteTasks(input, package_, options, packageManager),
		},
		{
			title: 'Git',
			task: () => gitTasks(options),
		},
		{
			title: 'Cleanup',
			enabled: () => runCleanup && !lockfile,
			task: () => deleteAsync('node_modules'),
		},
		{
			title: `Installing dependencies using ${packageManager.id}`,
			enabled: () => runCleanup,
			task: () => new Listr([
				{
					title: 'Running install command',
					task() {
						const installCommand = lockfile ? packageManager.installCommand : packageManager.installCommandNoLockfile;
						return exec(...installCommand);
					},
				},
				{
					title: 'Checking working tree is still clean', // If lockfile was out of date and tracked by git, this will fail
					task: () => git.verifyWorkingTreeIsClean(),
				},
			]),
		},
		{
			title: 'Running tests',
			enabled: () => runTests,
			task: () => exec(packageManager.cli, ['run', testScript], ciEnvOptions),
		},
		{
			title: 'Bumping version',
			skip() {
				if (options.preview) {
					const [cli, arguments_] = packageManager.versionCommand(input);

					if (options.message) {
						arguments_.push('--message', options.message.replaceAll('%s', input));
					}

					return `[Preview] Command not executed: ${printCommand([cli, arguments_])}`;
				}
			},
			task() {
				const [cli, arguments_] = packageManager.versionCommand(input);

				if (options.message) {
					arguments_.push('--message', options.message);
				}

				return exec(cli, arguments_);
			},
		},
		...options.runPublish ? [
			{
				title: 'Publishing package',
				skip() {
					if (options.preview) {
						const command = getPublishCommand(options);
						return `[Preview] Command not executed: ${printCommand(command)}.`;
					}
				},
				/** @type {(context, task) => Listr.ListrTaskResult<any>} */
				task(context, task) {
					let hasError = false;

					return from(runPublish(getPublishCommand(options)))
						.pipe(
							catchError(error => handleNpmError(error, task, otp => {
								context.otp = otp;

								return runPublish(getPublishCommand({...options, otp}));
							})),
						)
						.pipe(
							catchError(async error => {
								hasError = true;
								await rollback();
								throw new Error(`Error publishing package:\n${error.message}\n\nThe project was rolled back to its previous state.`);
							}),
							finalize(() => {
								publishStatus = hasError ? 'FAILED' : 'SUCCESS';
							}),
						);
				},
			},
			...shouldEnable2FA ? [{
				title: 'Enabling two-factor authentication',
				async skip() {
					if (options.preview) {
						const arguments_ = await getEnable2faArguments(package_.name, options);
						return `[Preview] Command not executed: npm ${arguments_.join(' ')}.`;
					}
				},
				task: (context, task) => enable2fa(task, package_.name, {otp: context.otp}),
			}] : [],
		] : [],
		{
			title: 'Pushing tags',
			async skip() {
				if (!(await git.hasUpstream())) {
					return 'Upstream branch not found; not pushing.';
				}

				if (options.preview) {
					return '[Preview] Command not executed: git push --follow-tags.';
				}

				if (publishStatus === 'FAILED' && options.runPublish) {
					return 'Couldn\'t publish package to npm; not pushing.';
				}
			},
			async task() {
				pushedObjects = await git.pushGraceful(isOnGitHub);
			},
		},
		...options.releaseDraft ? [{
			title: 'Creating release draft on GitHub',
			enabled: () => isOnGitHub === true,
			skip() {
				if (options.preview) {
					return '[Preview] GitHub Releases draft will not be opened in preview mode.';
				}
			},
			task: () => releaseTaskHelper(options, package_, packageManager),
		}] : [],
	], {
		showSubtasks: false,
		renderer: options.renderer ?? 'default',
	});

	if (!options.runPublish) {
		publishStatus = 'SUCCESS';
	}

	await tasks.run();

	if (pushedObjects) {
		console.error(`\n${logSymbols.error} ${pushedObjects.reason}`);
	}

	const {package_: newPackage} = await util.readPackage();
	return newPackage;
};

export default np;
