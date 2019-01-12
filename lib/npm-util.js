'use strict';
const execa = require('execa');
const pTimeout = require('p-timeout');

exports.connectToNpm = () => pTimeout(
	(async () => {
		try {
			await execa('npm', ['ping']);
			return true;
		} catch (_) {
			throw new Error('Connection to npm registry failed');
		}
	})(),
	15000,
	'Connection to npm registry timed out'
);

exports.npmUsername = async () => {
	try {
		return await execa.stdout('npm', ['whoami']);
	} catch (error) {
		return error;
	}
};

exports.npmCollaborators = async pkgName => {
	try {
		return await execa.stdout('npm', ['access', 'ls-collaborators', pkgName]);
	} catch (error) {
		// Ignore non-existing package error
		if (error.stderr.includes('code E404')) {
			return '404';
		}

		throw error;
	}
};

exports.tagVersionPrefix = async yarn => {
	let prefix = 'v';

	try {
		prefix = await execa.stdout(yarn ? 'yarn' : 'npm', ['config', 'get', yarn ? 'version-tag-prefix' : 'tag-version-prefix']);
	} catch (_) {}

	return prefix;
};

exports.prereleaseTags = async pkgName => {
	const stdout = await execa.stdout('npm', ['view', '--json', pkgName, 'dist-tags']);

	const tags = Object.keys(JSON.parse(stdout))
		.filter(tag => tag !== 'latest');

	if (tags.length === 0) {
		tags.push('next');
	}

	return tags;
};
