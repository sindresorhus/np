'use strict';
const semver = require('semver');
const execa = require('execa');
const del = require('del');

const exec = (cmd, args) => {
	const result = execa.sync(cmd, args);

	if (result.stderr !== '') {
		throw new Error(result.stderr);
	}

	return result.stdout;
};

module.exports = input => {
	input = input || 'patch';

	if (!['patch', 'minor', 'major'].includes(input) && !semver.valid(input)) {
		throw new Error('Version should be either path, minor, major, or a valid semver version.');
	}

	if (semver.gte(process.version, '6.0.0')) {
		throw new Error('You should not publish when running Node.js 6. Please downgrade and publish again. https://github.com/npm/npm/issues/5082');
	}

	if (exec('git', ['status', '--porcelain']) !== '') {
		throw new Error('Unclean working tree. Commit or stash changes first.');
	}

	if (exec('git', ['rev-list', '--count', '--left-only', '@{u}...HEAD']) !== '0') {
		throw new Error('Remote history differ. Please pull changes.');
	}

	del.sync('node_modules');

	exec('npm', ['install']);
	exec('npm', ['test']);
	exec('npm', ['version', input]);
	exec('npm', ['publish']);
	exec('git', ['push', '--follow-tags']);
};
