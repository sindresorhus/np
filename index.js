'use strict';
const fs = require('fs');
const semver = require('semver');
const execa = require('execa');
const del = require('del');
const pify = require('pify');
const Listr = require('listr');
const split = require('split');
require('any-observable/register/rxjs-all');
const Observable = require('any-observable');
const streamToObservable = require('stream-to-observable');

const fsP = pify(fs);
const VERSIONS = ['major', 'minor', 'patch', 'premajor', 'preminor', 'prepatch', 'prerelease'];

const exec = (cmd, args) => {
	// Use `Observable` support if merged https://github.com/sindresorhus/execa/pull/26
	const cp = execa(cmd, args);

	return Observable.merge(
		streamToObservable(cp.stdout.pipe(split()), {await: cp}),
		streamToObservable(cp.stderr.pipe(split()), {await: cp})
	).filter(Boolean);
};

const gitTasks = opts => {
	const tasks = [
		{
			title: 'Check current branch',
			task: () => execa.stdout('git', ['symbolic-ref', '--short', 'HEAD']).then(branch => {
				if (branch !== 'master') {
					throw new Error('Not on `master` branch. Use --any-branch to publish anyway.');
				}
			})
		},
		{
			title: 'Check local working tree',
			task: () => execa.stdout('git', ['status', '--porcelain']).then(status => {
				if (status !== '') {
					throw new Error('Unclean working tree. Commit or stash changes first.');
				}
			})
		},
		{
			title: 'Fetch remote changes',
			task: () => execa('git', ['fetch'])
		},
		{
			title: 'Check remote history',
			task: () => execa.stdout('git', ['rev-list', '--count', '--left-only', '@{u}...HEAD']).then(result => {
				if (result !== '0') {
					throw new Error('Remote history differ. Please pull changes.');
				}
			})
		}
	];

	if (opts.anyBranch) {
		tasks.shift();
	}

	return new Listr(tasks);
};

module.exports = (input, opts) => {
	input = input || 'patch';
	opts = opts || {};

	const runTests = !opts.yolo;
	const runCleanup = !opts.skipCleanup && !opts.yolo;

	if (VERSIONS.indexOf(input) === -1 && !semver.valid(input)) {
		return Promise.reject(new Error(`Version should be either ${VERSIONS.join(', ')}, or a valid semver version.`));
	}

	if (semver.gte(process.version, '6.0.0') && semver.lte(process.version, '6.2.0')) {
		return Promise.reject(new Error('You should not publish when running Node.js 6.0.0 - 6.2.0. Please downgrade or upgrade to latest and publish again. https://github.com/npm/npm/issues/5082'));
	}
 
 	const tasks = new Listr([
		{
			title: 'Git',
			task: () => gitTasks(opts)
		}
	]);

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
			task: () => exec('npm', ['version', input])
		},
		{
			title: 'Publishing package',
			task: () => exec('npm', ['publish'].concat(opts.tag ? ['--tag', opts.tag] : []))
		},
		{
			title: 'Pushing tags',
			task: () => exec('git', ['push', '--follow-tags'])
		}
	]);

	return tasks.run()
		.then(() => fsP.readFile('package.json', 'utf8'))
		.then(JSON.parse);
};
