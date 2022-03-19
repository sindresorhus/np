'use strict';
const fs = require('fs');
const path = require('path');
const execa = require('execa');
const pTimeout = require('p-timeout');
const {default: ow} = require('ow');
const npmName = require('npm-name');
const chalk = require('chalk');
const pkgDir = require('pkg-dir');
const ignoreWalker = require('ignore-walk');
const minimatch = require('minimatch');
const {verifyRequirementSatisfied} = require('../version');

// According to https://docs.npmjs.com/files/package.json#files
// npm's default behavior is to ignore these files.
const filesIgnoredByDefault = [
	'.*.swp',
	'.npmignore',
	'.gitignore',
	'._*',
	'.DS_Store',
	'.hg',
	'.npmrc',
	'.lock-wscript',
	'.svn',
	'.wafpickle-N',
	'*.orig',
	'config.gypi',
	'CVS',
	'node_modules/**/*',
	'npm-debug.log',
	'package-lock.json',
	'.git/**/*',
	'.git'
];

exports.checkConnection = () => pTimeout(
	(async () => {
		try {
			await execa('npm', ['ping']);
			return true;
		} catch {
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

exports.collaborators = async pkg => {
	const packageName = pkg.name;
	ow(packageName, ow.string);

	const args = ['access', 'ls-collaborators', packageName];
	if (exports.isExternalRegistry(pkg)) {
		args.push('--registry', pkg.publishConfig.registry);
	}

	try {
		const {stdout} = await execa('npm', args);
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
	const args = [pkg.name];
	const availability = {
		isAvailable: false,
		isUnknown: false
	};

	if (exports.isExternalRegistry(pkg)) {
		args.push({
			registryUrl: pkg.publishConfig.registry
		});
	}

	try {
		availability.isAvailable = await npmName(...args) || false;
	} catch {
		availability.isUnknown = true;
	}

	return availability;
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

exports.checkIgnoreStrategy = ({files}) => {
	if (!files && !npmignoreExistsInPackageRootDir()) {
		console.log(`
		\n${chalk.bold.yellow('Warning:')} No ${chalk.bold.cyan('files')} field specified in ${chalk.bold.magenta('package.json')} nor is a ${chalk.bold.magenta('.npmignore')} file present. Having one of those will prevent you from accidentally publishing development-specific files along with your package's source code to npm.
		`);
	}
};

function npmignoreExistsInPackageRootDir() {
	const rootDir = pkgDir.sync();
	return fs.existsSync(path.resolve(rootDir, '.npmignore'));
}

function excludeGitAndNodeModulesPaths(singlePath) {
	return !singlePath.startsWith('.git/') && !singlePath.startsWith('node_modules/');
}

async function getFilesIgnoredByDotnpmignore(pkg, fileList) {
	const allowList = (await ignoreWalker({
		path: pkgDir.sync(),
		ignoreFiles: ['.npmignore']
	})).filter(singlePath => excludeGitAndNodeModulesPaths(singlePath));
	return fileList.filter(minimatch.filter(getIgnoredFilesGlob(allowList, pkg.directories), {matchBase: true, dot: true}));
}

function filterFileList(globArray, fileList) {
	if (globArray.length === 0) {
		return [];
	}

	const globString = globArray.length > 1 ? `{${globArray.filter(singlePath => excludeGitAndNodeModulesPaths(singlePath))}}` : globArray[0];
	return fileList.filter(minimatch.filter(globString, {matchBase: true, dot: true})); // eslint-disable-line unicorn/no-fn-reference-in-iterator
}

async function getFilesIncludedByDotnpmignore(pkg, fileList) {
	const allowList = await ignoreWalker({
		path: pkgDir.sync(),
		ignoreFiles: ['.npmignore']
	});
	return filterFileList(allowList, fileList);
}

function getFilesNotIncludedInFilesProperty(pkg, fileList) {
	const globArrayForFilesAndDirectories = [...pkg.files];
	const rootDir = pkgDir.sync();
	for (const glob of pkg.files) {
		try {
			if (fs.statSync(path.resolve(rootDir, glob)).isDirectory()) {
				globArrayForFilesAndDirectories.push(`${glob}/**/*`);
			}
		} catch {}
	}

	const result = fileList.filter(minimatch.filter(getIgnoredFilesGlob(globArrayForFilesAndDirectories, pkg.directories), {matchBase: true, dot: true}));
	return result.filter(minimatch.filter(getDefaultIncludedFilesGlob(pkg.main), {nocase: true, matchBase: true}));
}

function getFilesIncludedInFilesProperty(pkg, fileList) {
	const globArrayForFilesAndDirectories = [...pkg.files];
	const rootDir = pkgDir.sync();
	for (const glob of pkg.files) {
		try {
			if (fs.statSync(path.resolve(rootDir, glob)).isDirectory()) {
				globArrayForFilesAndDirectories.push(`${glob}/**/*`);
			}
		} catch {}
	}

	return filterFileList(globArrayForFilesAndDirectories, fileList);
}

function getDefaultIncludedFilesGlob(mainFile) {
	// According to https://docs.npmjs.com/files/package.json#files
	// npm's default behavior is to always include these files.
	const filesAlwaysIncluded = [
		'package.json',
		'README*',
		'CHANGES*',
		'CHANGELOG*',
		'HISTORY*',
		'LICENSE*',
		'LICENCE*',
		'NOTICE*'
	];
	if (mainFile) {
		filesAlwaysIncluded.push(mainFile);
	}

	return `!{${filesAlwaysIncluded}}`;
}

function getIgnoredFilesGlob(globArrayFromFilesProperty, packageDirectories) {
	// Test files are assumed not to be part of the package
	let testDirectoriesGlob = '';
	if (packageDirectories && Array.isArray(packageDirectories.test)) {
		testDirectoriesGlob = packageDirectories.test.join(',');
	} else if (packageDirectories && typeof packageDirectories.test === 'string') {
		testDirectoriesGlob = packageDirectories.test;
	} else {
		// Fallback to `test` directory
		testDirectoriesGlob = 'test/**/*';
	}

	return `!{${globArrayFromFilesProperty.join(',')},${filesIgnoredByDefault.join(',')},${testDirectoriesGlob}}`;
}

// Get all files which will be ignored by either `.npmignore` or the `files` property in `package.json` (if defined).
exports.getNewAndUnpublishedFiles = async (pkg, newFiles = []) => {
	if (pkg.files) {
		return getFilesNotIncludedInFilesProperty(pkg, newFiles);
	}

	if (npmignoreExistsInPackageRootDir()) {
		return getFilesIgnoredByDotnpmignore(pkg, newFiles);
	}

	return [];
};

exports.getFirstTimePublishedFiles = async (pkg, newFiles = []) => {
	let result;
	if (pkg.files) {
		result = getFilesIncludedInFilesProperty(pkg, newFiles);
	} else if (npmignoreExistsInPackageRootDir()) {
		result = await getFilesIncludedByDotnpmignore(pkg, newFiles);
	} else {
		result = newFiles;
	}

	return result.filter(minimatch.filter(`!{${filesIgnoredByDefault}}`, {matchBase: true, dot: true})).filter(minimatch.filter(getDefaultIncludedFilesGlob(pkg.main), {nocase: true, matchBase: true}));
};

exports.getRegistryUrl = async (pkgManager, pkg) => {
	const args = ['config', 'get', 'registry'];
	if (exports.isExternalRegistry(pkg)) {
		args.push('--registry');
		args.push(pkg.publishConfig.registry);
	}

	const {stdout} = await execa(pkgManager, args);
	return stdout;
};
