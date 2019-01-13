'use strict';
const execa = require('execa');
const pTimeout = require('p-timeout');
const ow = require('ow');

exports.checkConnection = () => pTimeout(
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

exports.username = () => execa.stdout('npm', ['whoami']);

exports.collaborators = async packageName => {
	ow(packageName, ow.string());

	try {
		return await execa.stdout('npm', ['access', 'ls-collaborators', packageName]);
	} catch (error) {
		// Ignore non-existing package error
		if (error.stderr.includes('code E404')) {
			return false;
		}

		throw error;
	}
};

exports.prereleaseTags = async packageName => {
	ow(packageName, ow.string());

	const stdout = await execa.stdout('npm', ['view', '--json', packageName, 'dist-tags']);

	const tags = Object.keys(JSON.parse(stdout))
		.filter(tag => tag !== 'latest');

	if (tags.length === 0) {
		tags.push('next');
	}

	return tags;
};
