import path from 'node:path';
import {pathExists} from 'path-exists';
import {execa} from 'execa';
import pTimeout from 'p-timeout';
import ow from 'ow';
import npmName from 'npm-name';
import chalk from 'chalk-template';
import * as util from '../util.js';

export const version = async () => {
	const {stdout} = await execa('npm', ['--version']);
	return stdout;
};

export const checkConnection = () => pTimeout(
	(async () => {
		try {
			await execa('npm', ['ping']);
			return true;
		} catch {
			throw new Error('Connection to npm registry failed');
		}
	})(), {
		milliseconds: 15_000,
		message: 'Connection to npm registry timed out',
	},
);

export const username = async ({externalRegistry}) => {
	const args = ['whoami'];

	if (externalRegistry) {
		args.push('--registry', externalRegistry);
	}

	try {
		const {stdout} = await execa('npm', args);
		return stdout;
	} catch (error) {
		const message = /ENEEDAUTH/.test(error.stderr)
			? 'You must be logged in. Use `npm login` and try again.'
			: 'Authentication error. Use `npm whoami` to troubleshoot.';
		throw new Error(message);
	}
};

export const isExternalRegistry = pkg => typeof pkg.publishConfig?.registry === 'string';

export const collaborators = async pkg => {
	const packageName = pkg.name;
	ow(packageName, ow.string);

	const arguments_ = ['access', 'list', 'collaborators', packageName, '--json'];

	if (isExternalRegistry(pkg)) {
		arguments_.push('--registry', pkg.publishConfig.registry);
	}

	try {
		const {stdout} = await execa('npm', arguments_);
		return stdout;
	} catch (error) {
		// Ignore non-existing package error
		if (error.stderr.includes('code E404')) {
			return false;
		}

		throw error;
	}
};

export const prereleaseTags = async packageName => {
	ow(packageName, ow.string);

	let tags = [];
	try {
		const {stdout} = await execa('npm', ['view', '--json', packageName, 'dist-tags']);
		tags = Object.keys(JSON.parse(stdout))
			.filter(tag => tag !== 'latest');
	} catch (error) {
		// HACK: NPM is mixing JSON with plain text errors. Luckily, the error
		// always starts with 'npm ERR!' (unless you have a debugger attached)
		// so as a solution, until npm/cli#2740 is fixed, we can remove anything
		// starting with 'npm ERR!'
		/** @type {string} */
		const errorMessage = error.stderr;
		const errorJSON = errorMessage
			.split('\n')
			.filter(error => !error.startsWith('npm ERR!'))
			.join('\n');

		if (((JSON.parse(errorJSON) || {}).error || {}).code !== 'E404') {
			throw error;
		}
	}

	if (tags.length === 0) {
		tags.push('next');
	}

	return tags;
};

export const isPackageNameAvailable = async pkg => {
	const args = [pkg.name];
	const availability = {
		isAvailable: false,
		isUnknown: false,
	};

	if (isExternalRegistry(pkg)) {
		args.push({
			registryUrl: pkg.publishConfig.registry,
		});
	}

	try {
		availability.isAvailable = await npmName(...args) || false;
	} catch {
		availability.isUnknown = true;
	}

	return availability;
};

export const verifyRecentNpmVersion = async () => {
	const npmVersion = await version();
	util.validateEngineVersionSatisfies('npm', npmVersion);
};

export const checkIgnoreStrategy = async ({files}, rootDir) => {
	const npmignoreExistsInPackageRootDir = await pathExists(path.resolve(rootDir, '.npmignore'));

	if (!files && !npmignoreExistsInPackageRootDir) {
		console.log(chalk`
		\n{bold.yellow Warning:} No {bold.cyan files} field specified in {bold.magenta package.json} nor is a {bold.magenta .npmignore} file present. Having one of those will prevent you from accidentally publishing development-specific files along with your package's source code to npm.
		`);
	}
};

export const getFilesToBePacked = async rootDir => {
	const {stdout} = await execa('npm', ['pack', '--dry-run', '--json'], {cwd: rootDir});

	const {files} = JSON.parse(stdout).at(0);
	return files.map(file => file.path);
};

export const getRegistryUrl = async (pkgManager, pkg) => {
	const args = ['config', 'get', 'registry'];
	if (isExternalRegistry(pkg)) {
		args.push('--registry', pkg.publishConfig.registry);
	}

	const {stdout} = await execa(pkgManager, args);
	return stdout;
};
