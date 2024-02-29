import process from 'node:process';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {readPackageUp} from 'read-package-up';
import {parsePackage} from 'read-pkg';
import issueRegex from 'issue-regex';
import terminalLink from 'terminal-link';
import {execa} from 'execa';
import pMemoize from 'p-memoize';
import chalk from 'chalk';
import Version from './version.js';
import * as git from './git-util.js';
import * as npm from './npm/util.js';

export const assert = (condition, message) => {
	if (!condition) {
		throw new Error(message);
	}
};

export const readPackage = async (packagePath = process.cwd()) => {
	const packageResult = await readPackageUp({cwd: packagePath});

	if (!packageResult) {
		throw new Error('No `package.json` found. Make sure the current directory is a valid package.');
	}

	return {package_: packageResult.packageJson, rootDirectory: path.dirname(packageResult.path)};
};

const _npRootDirectory = fileURLToPath(new URL('..', import.meta.url));

// Re-define `npRootDirectory` for trailing slash consistency.
export const {package_: npPackage, rootDirectory: npRootDirectory} = await readPackage(_npRootDirectory);

export const linkifyIssues = (url, message) => {
	if (!(url && terminalLink.isSupported)) {
		return message;
	}

	return message.replace(issueRegex(), issue => {
		const issuePart = issue.replace('#', '/issues/');

		if (issue.startsWith('#')) {
			return terminalLink(issue, `${url}${issuePart}`);
		}

		return terminalLink(issue, `https://github.com/${issuePart}`);
	});
};

export const linkifyCommit = (url, commit) => {
	if (!(url && terminalLink.isSupported)) {
		return commit;
	}

	return terminalLink(commit, `${url}/commit/${commit}`);
};

export const linkifyCommitRange = (url, commitRange) => {
	if (!(url && terminalLink.isSupported)) {
		return commitRange;
	}

	return terminalLink(commitRange, `${url}/compare/${commitRange}`);
};

/** @type {(config: import('./package-manager/types.js').PackageManagerConfig) => Promise<string>} */
export const getTagVersionPrefix = pMemoize(async config => {
	assert(config && Object.hasOwn(config, 'tagVersionPrefixCommand'), 'Config is missing key `tagVersionPrefixCommand`');

	try {
		const {stdout} = await execa(...config.tagVersionPrefixCommand);

		return stdout;
	} catch {
		return 'v';
	}
});

export const joinList = list => chalk.reset(list.map(item => `- ${item}`).join('\n'));

export const groupFilesInFolders = (files, groupingMinimumDepth = 1, groupingThresholdCount = 5) => {
	const groups = {};
	for (const file of files) {
		const groupKey = path.join(...file.split(path.sep).slice(0, groupingMinimumDepth));
		groups[groupKey] = [...groups[groupKey] ?? [], file];
	}

	const lines = [];
	for (const [folder, filesInFolder] of Object.entries(groups)) {
		if (filesInFolder.length > groupingThresholdCount) {
			lines.push(`- ${folder}/* ${chalk.bold.white(`(${filesInFolder.length} files)`)}`);
			continue;
		}

		for (const file of filesInFolder) {
			lines.push(`- ${file}`);
		}
	}

	return chalk.reset(lines.join('\n'));
};

export const getNewFiles = async rootDirectory => {
	const listNewFiles = await git.newFilesSinceLastRelease(rootDirectory);
	const listPackageFiles = await npm.getFilesToBePacked(rootDirectory);

	return {
		unpublished: listNewFiles.filter(file => !listPackageFiles.includes(file) && !file.startsWith('.git')),
		firstTime: listNewFiles.filter(file => listPackageFiles.includes(file)),
	};
};

export const getNewDependencies = async (newPackage, rootDirectory) => {
	let oldPackageFile;

	try {
		oldPackageFile = await git.readFileFromLastRelease(path.resolve(rootDirectory, 'package.json'));
	} catch {
		// Handle first time publish
		return Object.keys(newPackage.dependencies ?? {});
	}

	const oldPackage = parsePackage(oldPackageFile);

	const newDependencies = [];

	for (const dependency of Object.keys(newPackage.dependencies ?? {})) {
		if (!oldPackage.dependencies?.[dependency]) {
			newDependencies.push(dependency);
		}
	}

	return newDependencies;
};

/** @type {(config: import('./package-manager/types.js').PackageManagerConfig) => Promise<string>} */
export const getPreReleasePrefix = pMemoize(async config => {
	assert(config && Object.hasOwn(config, 'cli'), 'Config is missing key `cli`');

	try {
		const {stdout} = await execa(config.cli, ['config', 'get', 'preid']);

		return stdout === 'undefined' ? '' : stdout;
	} catch {
		return '';
	}
});

export const validateEngineVersionSatisfies = (engine, version) => {
	const engineRange = npPackage.engines[engine];
	if (!new Version(version).satisfies(engineRange)) {
		throw new Error(`\`np\` requires ${engine} ${engineRange}`);
	}
};

export async function getNpmPackageAccess(name) {
	const {stdout} = await execa('npm', ['access', 'get', 'status', name, '--json']);
	return JSON.parse(stdout)[name]; // Note: returns "private" for non-existent packages
}
