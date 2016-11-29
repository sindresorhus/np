'use strict';
const execa = require('execa');
const del = require('del');
const Listr = require('listr');
const split = require('split');
require('any-observable/register/rxjs-all'); // eslint-disable-line import/no-unassigned-import
const Observable = require('any-observable');
const streamToObservable = require('stream-to-observable');
const readPkgUp = require('read-pkg-up');
const prerequisiteTasks = require('./lib/prerequisite');
const gitTasks = require('./lib/git');
const util = require('./lib/util');

const exec = (cmd, args) => {
	// Use `Observable` support if merged https://github.com/sindresorhus/execa/pull/26
	const cp = execa(cmd, args);

	return Observable.merge(
		streamToObservable(cp.stdout.pipe(split()), {await: cp}),
		streamToObservable(cp.stderr.pipe(split()), {await: cp})
	).filter(Boolean);
};

module.exports = (input, opts) => {
	input = input || 'patch';
	opts = opts || {};

	const runTests = !opts.yolo;
	const runCleanup = !opts.skipCleanup && !opts.yolo;
	const pkg = util.readPkg();

	const tasks = new Listr([
		{
			title: 'Prerequisite check',
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
				title: 'Installing dependencies',
				task: () => exec('npm', ['install'])
			}
		]);
	}

	if (runTests) {
		tasks.add({
			title: 'Running tests',
			task: () => exec('npm', ['test'])
		});
	}

	tasks.add([
		{
			title: 'Bumping version',
			// Specify --force flag to proceed even if the working directory is dirty as np already does a dirty check anyway
			task: () => exec('npm', ['version', input, '--force'])
		},
		{
			title: 'Publishing package',
			skip: () => {
				if (pkg.private) {
					return 'Private package: not publishing to npm.';
				}
			},
			task: () => exec('npm', ['publish'].concat(opts.tag ? ['--tag', opts.tag] : []))
		},
		{
			title: 'Pushing tags',
			task: () => exec('git', ['push', '--follow-tags'])
		}
	]);

	return tasks.run()
		.then(() => readPkgUp())
		.then(result => result.pkg);
};
