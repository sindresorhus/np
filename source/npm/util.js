'use strict';
const execa = require('execa');
const pTimeout = require('p-timeout');
const ow = require('ow');
const npmName = require('npm-name');
const {verifyRequirementSatisfied} = require('../version');

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

exports.username = async ({externalRegistry}) => {
	const args = ['whoami'];

	if (externalRegistry) {
		args.push('--registry', externalRegistry);
	}

	try {
		const {stdout} = await execa('npm', args);
		return stdout;
	} catch (error) {
		throw new Error(/ENEEDAUTH/.test(error.stderr) ?
			'You must be logged in. Use `npm login` and try again.' :
			'Authentication error. Use `npm whoami` to troubleshoot.');
	}
};

exports.collaborators = async packageName => {
	ow(packageName, ow.string);

	try {
		const {stdout} = await execa('npm', ['access', 'ls-collaborators', packageName]);
		return stdout;
	} catch (error) {
		// Ignore non-existing package error
		if (error.stderr.includes('code E404')) {
			return false;
		}

		throw error;
	}
};

exports.prereleaseTags = async packageName => {
	ow(packageName, ow.string);

	let tags = [];
	try {
		const {stdout} = await execa('npm', ['view', '--json', packageName, 'dist-tags']);
		tags = Object.keys(JSON.parse(stdout))
			.filter(tag => tag !== 'latest');
	} catch (error) {
		if (((JSON.parse(error.stdout) || {}).error || {}).code !== 'E404') {
			throw error;
		}
	}

	if (tags.length === 0) {
		tags.push('next');
	}

	return tags;
};

exports.isPackageNameAvailable = async pkg => {
	const isExternalRegistry = exports.isExternalRegistry(pkg);
	if (isExternalRegistry) {
		return true;
	}

	return npmName(pkg.name);
};

exports.isExternalRegistry = pkg => typeof pkg.publishConfig === 'object' && typeof pkg.publishConfig.registry === 'string';

exports.version = async () => {
	const {stdout} = await execa('npm', ['--version']);
	return stdout;
};

exports.verifyRecentNpmVersion = async () => {
	const npmVersion = await exports.version();
	verifyRequirementSatisfied('npm', npmVersion);
};
