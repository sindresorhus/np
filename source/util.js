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
import semver from 'semver';
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
	if (!url) {
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
	if (!url) {
		return commit;
	}

	return terminalLink(commit, `${url}/commit/${commit}`);
};

export const linkifyCommitRange = (url, commitRange) => {
	if (!url) {
		return commitRange;
	}

	return terminalLink(commitRange, `${url}/compare/${commitRange}`);
};

/*
Git URL patterns for parsing various formats.

Patterns use greedy matching + cleanRepo logic to handle edge cases like:
- URLs with double .git suffix (repo.git.git)
- Repos with .git in their name (my.git.git where repo is my.git)

Using [^\s/?#] to exclude whitespace, query params (?), and fragments (#)
Query params and fragments are stripped before matching.
*/
const GIT_URL_PATTERNS = [
	/// https://host/owner/repo.git or https://host/owner/repo
	// Case-insensitive protocol matching via /i flag
	{
		regex: /^https?:\/\/([^\s/?#]+)\/([^\s/?#]+)\/([^\s/?#]+)(\.git)?$/i,
		transform: (host, owner, repo) => `https://${host}/${owner}/${repo}`,
	},
	/// git@host:owner/repo.git (common SSH format)
	// Using [^\s:?#] and [^\s/?#] creates clear boundaries
	{
		regex: /^git@([^\s:?#]+):([^\s/?#]+)\/([^\s/?#]+)(\.git)?$/,
		transform: (host, owner, repo) => `https://${host}/${owner}/${repo}`,
	},
	/// git+https://host/owner/repo.git
	{
		regex: /^git\+https:\/\/([^\s/?#]+)\/([^\s/?#]+)\/([^\s/?#]+)(\.git)?$/i,
		transform: (host, owner, repo) => `https://${host}/${owner}/${repo}`,
	},
	/// ssh://git@host/owner/repo.git
	{
		regex: /^ssh:\/\/git@([^\s/?#]+)\/([^\s/?#]+)\/([^\s/?#]+)(\.git)?$/i,
		transform: (host, owner, repo) => `https://${host}/${owner}/${repo}`,
	},
];

const ALPHANUMERIC_REGEX = /[a-z\d]/i;
const isValidGitPathComponent = value => Boolean(value) && ALPHANUMERIC_REGEX.test(value);

/**
Parse a git URL to extract the HTTPS browse URL.

Handles various git URL formats including GitHub Enterprise.

This function uses carefully crafted regex patterns that avoid ReDoS vulnerabilities:
- All patterns are anchored with ^ and $ to prevent partial matches
- Character classes use negated sets [^...] which are linear-time
- No nested quantifiers or overlapping alternatives
- Greedy quantifiers with explicit bounds prevent exponential backtracking

@param {string} url - The git URL to parse.
@returns {string | undefined} - The HTTPS browse URL or undefined if parsing fails.

@example
```
parseGitUrl('git@github.com:owner/repo.git');
//=> 'https://github.com/owner/repo'

parseGitUrl('https://github.com/owner/repo.git');
//=> 'https://github.com/owner/repo'

parseGitUrl('github:owner/repo');
//=> undefined (use hosted-git-info for this)
```
*/
export const parseGitUrl = url => {
	if (typeof url !== 'string' || url.length === 0) {
		return;
	}

	const cleanUrl = url.split(/[?#]/, 1)[0];
	if (cleanUrl.length === 0) {
		return;
	}

	for (const {regex, transform} of GIT_URL_PATTERNS) {
		const match = cleanUrl.match(regex);
		if (match) {
			const [, host, owner, repo] = match;

			// Remove .git suffix if present in the captured repo name
			const cleanRepo = repo.endsWith('.git') ? repo.slice(0, -4) : repo;

			// Validate that none of the components are empty
			if (!host) {
				continue;
			}

			// Validate that owner and repo contain at least one alphanumeric character
			// This prevents pathological inputs like all dots or special chars
			if (!isValidGitPathComponent(owner) || !isValidGitPathComponent(cleanRepo)) {
				continue;
			}

			return transform(host, owner, cleanRepo);
		}
	}
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

export async function getNpmPackageAccess(package_) {
	const arguments_ = ['access', 'get', 'status', package_.name, '--json'];

	if (package_.publishConfig?.registry) {
		arguments_.push('--registry', package_.publishConfig.registry);
	}

	try {
		const {stdout} = await execa('npm', arguments_, {timeout: npm.npmNetworkTimeout});
		return JSON.parse(stdout)[package_.name]; // Note: returns "private" for non-existent packages
	} catch (error) {
		if (error.timedOut) {
			error.message = 'Connection to npm registry timed out';
		}

		throw error;
	}
}

export const getMinimumNodeVersion = range => {
	if (!range || typeof range !== 'string') {
		return undefined;
	}

	try {
		const minVersion = semver.minVersion(range);
		return minVersion?.version;
	} catch {
		return undefined;
	}
};
