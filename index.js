'use strict';
require('any-observable/register/rxjs-all'); // eslint-disable-line import/no-unassigned-import
const fs = require('fs');
const path = require('path');
const execa = require('execa');
const del = require('del');
const Listr = require('listr');
const split = require('split');
const {merge, throwError} = require('rxjs');
const {catchError, filter} = require('rxjs/operators');
const streamToObservable = require('@samverschueren/stream-to-observable');
const readPkgUp = require('read-pkg-up');
const hasYarn = require('has-yarn');
const pkgDir = require('pkg-dir');
const prerequisiteTasks = require('./lib/prerequisite');
const gitTasks = require('./lib/git');
const util = require('./lib/util');
const publish = require('./lib/publish');

const exec = (cmd, args) => {
	// Use `Observable` support if merged https://github.com/sindresorhus/execa/pull/26
	const cp = execa(cmd, args);

	return merge(
		streamToObservable(cp.stdout.pipe(split()), {await: cp}),
		streamToObservable(cp.stderr.pipe(split()), {await: cp})
	).pipe(filter(Boolean));
};

module.exports = async (input = 'patch', options) => {
	options = {
		cleanup: true,
		publish: true,
		...options
	};

	if (!hasYarn() && options.yarn) {
		throw new Error('Could not use Yarn without yarn.lock file');
	}

	// TODO: Remove sometime far in the future
	if (options.skipCleanup) {
		options.cleanup = false;
	}

	const runTests = !options.yolo;
	const runCleanup = options.cleanup && !options.yolo;
	const runPublish = options.publish;
	const pkg = util.readPkg();
	const pkgManager = options.yarn === true ? 'yarn' : 'npm';
	const pkgManagerName = options.yarn === true ? 'Yarn' : 'npm';
	const rootDir = pkgDir.sync();
	const hasLockFile = fs.existsSync(path.resolve(rootDir, 'package-lock.json')) || fs.existsSync(path.resolve(rootDir, 'npm-shrinkwrap.json'));

	const tasks = new Listr([
		{
			title: 'Prerequisite check',
			enabled: () => runPublish,
			task: () => prerequisiteTasks(input, pkg, options)
		},
		{
			title: 'Git',
			task: () => gitTasks(options)
		}
	], {
		showSubtasks: false
	});

	if (runCleanup) {
		tasks.add([
			{
				title: 'Cleanup',
				skip: () => hasLockFile,
				task: () => del('node_modules')
			},
			{
				title: 'Installing dependencies using Yarn',
				enabled: () => options.yarn === true,
				task: () => exec('yarn', ['install', '--frozen-lockfile', '--production=false']).pipe(
					catchError(error => {
						if (error.stderr.startsWith('error Your lockfile needs to be updated')) {
							throwError(new Error('yarn.lock file is outdated. Run yarn, commit the updated lockfile and try again.'));
						}

						throwError(error);
					})
				)
			},
			{
				title: 'Installing dependencies using npm',
				enabled: () => options.yarn === false,
				task: () => {
					const args = hasLockFile ? ['ci'] : ['install', '--no-package-lock', '--no-production'];
					return exec('npm', args);
				}
			}
		]);
	}

	if (runTests) {
		tasks.add([
			{
				title: 'Running tests using npm',
				enabled: () => options.yarn === false,
				task: () => exec('npm', ['test'])
			},
			{
				title: 'Running tests using Yarn',
				enabled: () => options.yarn === true,
				task: () => exec('yarn', ['test']).pipe(
					catchError(error => {
						if (error.message.includes('Command "test" not found')) {
							return [];
						}

						throwError(error);
					})
				)
			}
		]);
	}

	tasks.add([
		{
			title: 'Bumping version using Yarn',
			enabled: () => options.yarn === true,
			task: () => exec('yarn', ['version', '--new-version', input])
		},
		{
			title: 'Bumping version using npm',
			enabled: () => options.yarn === false,
			task: () => exec('npm', ['version', input])
		}
	]);

	if (runPublish) {
		tasks.add([
			{
				title: `Publishing package using ${pkgManagerName}`,
				skip: () => {
					if (pkg.private) {
						return `Private package: not publishing to ${pkgManagerName}.`;
					}
				},
				task: (context, task) => publish(pkgManager, task, options, input)
			}
		]);
	}

	tasks.add({
		title: 'Pushing tags',
		task: () => exec('git', ['push', '--follow-tags'])
	});

	await tasks.run();

	const {pkg: newPkg} = await readPkgUp();
	return newPkg;
};
