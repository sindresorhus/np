'use strict';
require('any-observable/register/rxjs-all'); // eslint-disable-line import/no-unassigned-import
const execa = require('execa');
const del = require('del');
const Listr = require('listr');
const split = require('split');
const {merge, throwError} = require('rxjs');
const {catchError, filter} = require('rxjs/operators');
const streamToObservable = require('@samverschueren/stream-to-observable');
const readPkgUp = require('read-pkg-up');
const hasYarn = require('has-yarn');
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

module.exports = (input, opts) => {
	input = input || 'patch';

	opts = Object.assign({
		cleanup: true,
		publish: true
	}, opts);

	if (!hasYarn() && opts.yarn) {
		throw new Error('Could not use Yarn without yarn.lock file');
	}

	// TODO: remove sometime far in the future
	if (opts.skipCleanup) {
		opts.cleanup = false;
	}

	const runTests = !opts.yolo;
	const runCleanup = opts.cleanup && !opts.yolo;
	const runPublish = opts.publish;
	const pkg = util.readPkg();
	const pkgManager = opts.yarn === true ? 'yarn' : 'npm';
	const pkgManagerName = opts.yarn === true ? 'Yarn' : 'npm';

	const tasks = new Listr([
		{
			title: 'Prerequisite check',
			enabled: () => runPublish,
			task: () => prerequisiteTasks(input, pkg, opts)
		},
		{
			title: 'Git',
			task: () => gitTasks(opts)
		}
	], {
		showSubtasks: false
	});

	if (runCleanup) {
		tasks.add([
			{
				title: 'Cleanup',
				task: () => del('node_modules')
			},
			{
				title: 'Installing dependencies using Yarn',
				enabled: () => opts.yarn === true,
				task: () => exec('yarn', ['install', '--frozen-lockfile', '--production=false']).pipe(
					catchError(err => {
						if (err.stderr.startsWith('error Your lockfile needs to be updated')) {
							throwError(new Error('yarn.lock file is outdated. Run yarn, commit the updated lockfile and try again.'));
						}
						throwError(err);
					})
				)
			},
			{
				title: 'Installing dependencies using npm',
				enabled: () => opts.yarn === false,
				task: () => exec('npm', ['install', '--no-package-lock', '--no-production'])
			}
		]);
	}

	if (runTests) {
		tasks.add([
			{
				title: 'Running tests using npm',
				enabled: () => opts.yarn === false,
				task: () => exec('npm', ['test'])
			},
			{
				title: 'Running tests using Yarn',
				enabled: () => opts.yarn === true,
				task: () => exec('yarn', ['test']).pipe(
					catchError(err => {
						if (err.message.includes('Command "test" not found')) {
							return [];
						}

						throwError(err);
					})
				)
			}
		]);
	}

	tasks.add([
		{
			title: 'Bumping version using Yarn',
			enabled: () => opts.yarn === true,
			task: () => exec('yarn', ['version', '--new-version', input])
		},
		{
			title: 'Bumping version using npm',
			enabled: () => opts.yarn === false,
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
				task: (ctx, task) => publish(pkgManager, task, opts, input)
			}
		]);
	}

	tasks.add({
		title: 'Pushing tags',
		task: () => exec('git', ['push', '--follow-tags'])
	});

	return tasks.run()
		.then(() => readPkgUp())
		.then(result => result.pkg);
};
