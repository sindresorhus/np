'use strict';
const semver = require('semver');
const execa = require('execa');
const del = require('del');
const debug = require('debug')('np');

const VERSIONS = ['major', 'minor', 'patch', 'premajor', 'preminor', 'prepatch', 'prerelease'];

const exec = (cmd, args) => {
	// TODO Switch to `{stdio: 'inherit'}` instead of manual logging when a new execa version is released
	const result = execa.sync(cmd, args);

	if (result.stdout) {
		console.log(result.stdout);
	}

	if (result.stderr) {
		console.error(result.stderr);
	}

	if (result.status !== 0) {
		throw new Error(`Exitted with status ${result.status}.`);
	}
};

module.exports = (input, opts) => {
	input = input || 'patch';
	opts = opts || {};

	const execMaybe = (cmd, args) => {
		debug(cmd, args);
		if (!opts.dry) {
			exec(cmd, args);
		}
	};

	if (VERSIONS.indexOf(input) === -1 && !semver.valid(input)) {
		throw new Error(`Version should be either ${VERSIONS.join(', ')}, or a valid semver version.`);
	}

	if (semver.gte(process.version, '6.0.0')) {
		throw new Error('You should not publish when running Node.js 6. Please downgrade and publish again. https://github.com/npm/npm/issues/5082');
	}

	if (!opts.anyBranch && execa.sync('git', ['symbolic-ref', '--short', 'HEAD']).stdout !== 'master') {
		throw new Error('Not on `master` branch. Use --any-branch to publish anyway.');
	}

	if (execa.sync('git', ['status', '--porcelain']).stdout !== '') {
		throw new Error('Unclean working tree. Commit or stash changes first.');
	}

	if (opts.dry) {
		debug('dry run');
	}

	debug('git fetch');
	if (!opts.dry) {
		execa.sync('git', ['fetch']);
	}

	if (execa.sync('git', ['rev-list', '--count', '--left-only', '@{u}...HEAD']).stdout !== '0') {
		throw new Error('Remote history differ. Please pull changes.');
	}

	debug('del node_modules');
	if (!opts.dry) {
		del.sync('node_modules');
	}

	execMaybe('npm', ['install']);
	execMaybe('npm', ['test']);
	execMaybe('npm', ['version', input]);
	execMaybe('npm', ['publish']);
	execMaybe('git', ['push', '--follow-tags']);
};
