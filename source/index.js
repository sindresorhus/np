import 'any-observable/register/rxjs-all.js';
import fs from 'fs';
import path from 'path';
import execa from 'execa';
import del from 'del';
import Listr from 'listr';
import split from 'split';
import * as rxjs from 'rxjs';
import {catchError, filter, finalize} from 'rxjs/operators/index.js';
import streamToObservable from '@samverschueren/stream-to-observable';
import readPkgUp from 'read-pkg-up';
import hasYarn from 'has-yarn';
import pkgDir from 'pkg-dir';
import * as hostedGitInfo from 'hosted-git-info';
import onetime from 'onetime';
import exitHook from 'async-exit-hook';
import logSymbols from 'log-symbols';
import prerequisiteTasks from './prerequisite-tasks.js';
import gitTasks from './git-tasks.js';
import publish from './npm/publish.js';
import enable2fa from './npm/enable-2fa.js';
import * as npm from './npm/util.js';
import releaseTaskHelper from './release-task-helper.js';
import * as util from './util.js';
import * as git from './git-util.js';

const {merge, throwError} = rxjs;
const exec = (cmd, args) => {
	// Use `Observable` support if merged https://github.com/sindresorhus/execa/pull/26
	const cp = execa(cmd, args);
	return merge(
		streamToObservable(cp.stdout.pipe(split())),
		streamToObservable(cp.stderr.pipe(split())),
		cp
	).pipe(filter(Boolean));
};

const np = async (input = 'patch', options) => {
	if (!hasYarn() && options.yarn) {
		throw new Error('Could not use Yarn without yarn.lock file');
	}

	// TODO: Remove sometime far in the future
	if (options.skipCleanup) {
		options.cleanup = false;
	}

	const pkg = util.readPkg(options.contents);
	const runTests = options.tests && !options.yolo;
	const runCleanup = options.cleanup && !options.yolo;
	const pkgManager = options.yarn === true ? 'yarn' : 'npm';
	const pkgManagerName = options.yarn === true ? 'Yarn' : 'npm';
	const rootDir = pkgDir.sync();
	const hasLockFile =
		fs.existsSync(
			path.resolve(rootDir, options.yarn ? 'yarn.lock' : 'package-lock.json')
		) || fs.existsSync(path.resolve(rootDir, 'npm-shrinkwrap.json'));
	const isOnGitHub =
		options.repoUrl &&
		(hostedGitInfo.fromUrl(options.repoUrl) || {}).type === 'github';
	const testScript = options.testScript || 'test';
	const testCommand = options.testScript ? ['run', testScript] : [testScript];
	if (options.releaseDraftOnly) {
		await releaseTaskHelper(options, pkg);
		return pkg;
	}

	let publishStatus = 'UNKNOWN';
	let pushedObjects;
	const rollback = onetime(async () => {
		console.log('\nPublish failed. Rolling back to the previous state…');
		const tagVersionPrefix = await util.getTagVersionPrefix(options);
		const latestTag = await git.latestTag();
		const versionInLatestTag = latestTag.slice(tagVersionPrefix.length);
		try {
			if (
				versionInLatestTag === util.readPkg().version &&
				versionInLatestTag !== pkg.version
			) {
				// Verify that the package's version has been bumped before deleting the last tag and commit.
				await git.deleteTag(latestTag);
				await git.removeLastCommit();
			}

			console.log(
				'Successfully rolled back the project to its previous state.'
			);
		} catch (error) {
			console.log(
				`Couldn't roll back because of the following error:\n${error}`
			);
		}
	});
	// The default parameter is a workaround for https://github.com/Tapppi/async-exit-hook/issues/9
	exitHook((callback = () => {}) => {
		if (options.preview) {
			callback();
		} else if (publishStatus === 'FAILED') {
			(async () => {
				await rollback();
				callback();
			})();
		} else if (publishStatus === 'SUCCESS') {
			callback();
		} else {
			console.log('\nAborted!');
			callback();
		}
	});
	const tasks = new Listr(
		[
			{
				title: 'Prerequisite check',
				enabled: () => options.runPublish,
				task: () => prerequisiteTasks(input, pkg, options)
			},
			{
				title: 'Git',
				task: () => gitTasks(options)
			}
		],
		{
			showSubtasks: false
		}
	);
	if (runCleanup) {
		tasks.add([
			{
				title: 'Cleanup',
				enabled: () => !hasLockFile,
				task: () => del('node_modules')
			},
			{
				title: 'Installing dependencies using Yarn',
				enabled: () => options.yarn === true,
				task: () => {
					return exec('yarn', [
						'install',
						'--frozen-lockfile',
						'--production=false'
					]).pipe(
						catchError(async error => {
							if (
								!error.stderr.startsWith(
									'error Your lockfile needs to be updated'
								)
							) {
								return;
							}

							if (await git.checkIfFileGitIgnored('yarn.lock')) {
								return;
							}

							throw new Error(
								'yarn.lock file is outdated. Run yarn, commit the updated lockfile and try again.'
							);
						})
					);
				}
			},
			{
				title: 'Installing dependencies using npm',
				enabled: () => options.yarn === false,
				task: () => {
					const args = hasLockFile ?
						['ci'] :
						['install', '--no-package-lock', '--no-production'];
					return exec('npm', [...args, '--engine-strict']);
				}
			}
		]);
	}

	if (runTests) {
		tasks.add([
			{
				title: 'Running tests using npm',
				enabled: () => options.yarn === false,
				task: () => exec('npm', testCommand)
			},
			{
				title: 'Running tests using Yarn',
				enabled: () => options.yarn === true,
				task: () =>
					exec('yarn', testCommand).pipe(
						catchError(error => {
							if (error.message.includes(`Command "${testScript}" not found`)) {
								return [];
							}

							return throwError(error);
						})
					)
			}
		]);
	}

	tasks.add([
		{
			title: 'Bumping version using Yarn',
			enabled: () => options.yarn === true,
			skip: () => {
				if (options.preview) {
					let previewText = `[Preview] Command not executed: yarn version --new-version ${input}`;
					if (options.message) {
						previewText += ` --message '${options.message.replace(
							/%s/g,
							input
						)}'`;
					}

					return `${previewText}.`;
				}
			},
			task: () => {
				const args = ['version', '--new-version', input];
				if (options.message) {
					args.push('--message', options.message);
				}

				return exec('yarn', args);
			}
		},
		{
			title: 'Bumping version using npm',
			enabled: () => options.yarn === false,
			skip: () => {
				if (options.preview) {
					let previewText = `[Preview] Command not executed: npm version ${input}`;
					if (options.message) {
						previewText += ` --message '${options.message.replace(
							/%s/g,
							input
						)}'`;
					}

					return `${previewText}.`;
				}
			},
			task: () => {
				const args = ['version', input];
				if (options.message) {
					args.push('--message', options.message);
				}

				return exec('npm', args);
			}
		}
	]);
	if (options.runPublish) {
		tasks.add([
			{
				title: `Publishing package using ${pkgManagerName}`,
				skip: () => {
					if (options.preview) {
						const args = publish.getPackagePublishArguments(options);
						return `[Preview] Command not executed: ${pkgManager} ${args.join(
							' '
						)}.`;
					}
				},
				task: (context, task) => {
					let hasError = false;
					return publish(context, pkgManager, task, options).pipe(
						catchError(async error => {
							hasError = true;
							await rollback();
							throw new Error(
								`Error publishing package:\n${error.message}\n\nThe project was rolled back to its previous state.`
							);
						}),
						finalize(() => {
							publishStatus = hasError ? 'FAILED' : 'SUCCESS';
						})
					);
				}
			}
		]);
		const isExternalRegistry = npm.isExternalRegistry(pkg);
		if (
			options['2fa'] &&
			options.availability.isAvailable &&
			!options.availability.isUnknown &&
			!pkg.private &&
			!isExternalRegistry
		) {
			tasks.add([
				{
					title: 'Enabling two-factor authentication',
					skip: () => {
						if (options.preview) {
							const args = enable2fa.getEnable2faArgs(pkg.name, options);
							return `[Preview] Command not executed: npm ${args.join(' ')}.`;
						}
					},
					task: (context, task) =>
						enable2fa(task, pkg.name, {otp: context.otp})
				}
			]);
		}
	} else {
		publishStatus = 'SUCCESS';
	}

	tasks.add({
		title: 'Pushing tags',
		skip: async () => {
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
		task: async () => {
			pushedObjects = await git.pushGraceful(isOnGitHub);
		}
	});
	if (options.releaseDraft) {
		tasks.add({
			title: 'Creating release draft on GitHub',
			enabled: () => isOnGitHub === true,
			skip: () => {
				if (options.preview) {
					return '[Preview] GitHub Releases draft will not be opened in preview mode.';
				}
			},
			task: () => releaseTaskHelper(options, pkg)
		});
	}

	await tasks.run();
	if (pushedObjects) {
		console.error(`\n${logSymbols.error} ${pushedObjects.reason}`);
	}

	const {packageJson: newPkg} = await readPkgUp();
	return newPkg;
};

export default np;
