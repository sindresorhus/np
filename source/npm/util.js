import path from 'node:path';
import {pathExists} from 'path-exists';
import {execa} from 'execa';
import npmName from 'npm-name';
import chalk from 'chalk-template';
import * as util from '../util.js';

export const version = async () => {
	const {stdout} = await execa('npm', ['--version']);
	return stdout;
};

export const npmNetworkTimeout = 15_000; // 15 seconds for npm registry calls

const throwIfNpmTimeout = error => {
	if (error.timedOut) {
		error.message = 'Connection to npm registry timed out';
		throw error;
	}
};

export const checkConnection = async () => {
	try {
		await execa('npm', ['ping'], {timeout: npmNetworkTimeout});
		return true;
	} catch (error) {
		throwIfNpmTimeout(error);
		throw new Error('Connection to npm registry failed');
	}
};

export const username = async ({externalRegistry}) => {
	const arguments_ = ['whoami'];

	if (externalRegistry) {
		arguments_.push('--registry', externalRegistry);
	}

	try {
		const {stdout} = await execa('npm', arguments_, {timeout: npmNetworkTimeout});
		return stdout;
	} catch (error) {
		throwIfNpmTimeout(error);
		const isNotLoggedIn = /ENEEDAUTH|E401/.test(error.stderr);
		const message = isNotLoggedIn
			? 'You must be logged in. Use `npm login` and try again.'
			: 'Authentication error. Use `npm whoami` to troubleshoot.';
		const authError = new Error(message);
		authError.isNotLoggedIn = isNotLoggedIn;
		throw authError;
	}
};

export const login = async ({externalRegistry}) => {
	const arguments_ = ['login'];

	if (externalRegistry) {
		arguments_.push('--registry', externalRegistry);
	}

	try {
		await execa('npm', arguments_, {
			stdin: 'inherit',
			stdout: 'inherit',
			stderr: 'pipe',
		});
	} catch (error) {
		// User canceled the login prompt
		if (error.stderr?.includes('canceled')) {
			const cancelError = new Error('Login canceled');
			cancelError.name = 'ExitPromptError';
			throw cancelError;
		}

		throw error;
	}
};

const NPM_DEFAULT_REGISTRIES = new Set([
	// https://docs.npmjs.com/cli/v10/using-npm/registry
	'https://registry.npmjs.org',
	// https://docs.npmjs.com/cli/v10/commands/npm-profile#registry
	'https://registry.npmjs.org/',
]);
export const isExternalRegistry = package_ => {
	const registry = package_.publishConfig?.registry;
	if (typeof registry !== 'string') {
		return false;
	}

	const normalizedRegistry = registry.trim();
	const httpsVariant = normalizedRegistry.replace(/^http:\/\//, 'https://');

	return !NPM_DEFAULT_REGISTRIES.has(normalizedRegistry)
		&& !NPM_DEFAULT_REGISTRIES.has(httpsVariant);
};

export const collaborators = async package_ => {
	const packageName = package_.name;
	util.assert(typeof packageName === 'string', 'Package name is required');

	const arguments_ = ['access', 'list', 'collaborators', packageName, '--json'];

	if (package_.publishConfig?.registry) {
		arguments_.push('--registry', package_.publishConfig.registry);
	}

	try {
		const {stdout} = await execa('npm', arguments_, {timeout: npmNetworkTimeout});
		return stdout;
	} catch (error) {
		throwIfNpmTimeout(error);

		// Ignore non-existing package error
		if (error.stderr.includes('code E404')) {
			return false;
		}

		// External registries often don't support this endpoint, so ignore errors.
		// The whoami check is sufficient for verifying authentication.
		// See: https://github.com/sindresorhus/np/issues/420
		if (isExternalRegistry(package_)) {
			return false;
		}

		throw error;
	}
};

export const prereleaseTags = async packageName => {
	util.assert(typeof packageName === 'string', 'Package name is required');

	let tags = [];
	try {
		const {stdout} = await execa('npm', ['view', '--json', packageName, 'dist-tags'], {timeout: npmNetworkTimeout});
		tags = Object.keys(JSON.parse(stdout))
			.filter(tag => tag !== 'latest');
	} catch (error) {
		throwIfNpmTimeout(error);
		// HACK: NPM is mixing JSON with plain text errors. Luckily, the error
		// always starts with 'npm ERR!' (npm <10) or 'npm error' (npm >=10)
		// so as a solution, until npm/cli#2740 is fixed, we can remove anything
		// starting with 'npm ERR!' or 'npm error'
		/** @type {string} */
		const errorMessage = error.stderr;
		const errorJSON = errorMessage
			.split('\n')
			.filter(line => !line.startsWith('npm ERR!') && !line.startsWith('npm error'))
			.join('\n');

		try {
			const parsed = JSON.parse(errorJSON);
			// Only handle E404 errors gracefully; throw all other errors
			if (parsed?.error?.code !== 'E404') {
				throw error;
			}
		} catch {
			// If JSON parsing fails, we can't determine the error type, so throw the original error
			throw error;
		}
	}

	if (tags.length === 0) {
		tags.push('next');
	}

	return tags;
};

export const isPackageNameAvailable = async package_ => {
	const arguments_ = [package_.name];
	const availability = {
		isAvailable: false,
		isUnknown: false,
	};

	if (isExternalRegistry(package_)) {
		arguments_.push({
			registryUrl: package_.publishConfig.registry,
		});
	}

	try {
		availability.isAvailable = await npmName(...arguments_) || false;
	} catch {
		availability.isUnknown = true;
	}

	return availability;
};

export const verifyRecentNpmVersion = async () => {
	const npmVersion = await version();
	util.validateEngineVersionSatisfies('npm', npmVersion);
};

export const checkIgnoreStrategy = async ({files}, rootDirectory) => {
	const npmignoreExistsInPackageRootDirectory = await pathExists(path.resolve(rootDirectory, '.npmignore'));

	if (!files && !npmignoreExistsInPackageRootDirectory) {
		console.log(chalk`
		\n{bold.yellow Warning:} No {bold.cyan files} field specified in {bold.magenta package.json} nor is a {bold.magenta .npmignore} file present. Having one of those will prevent you from accidentally publishing development-specific files along with your package's source code to npm.
		`);
	}
};

export const getFilesToBePacked = async rootDirectory => {
	const {stdout} = await execa('npm', [
		'pack',
		'--dry-run',
		'--json',
		'--silent',
		// TODO: Remove this once [npm/cli#7354](https://github.com/npm/cli/issues/7354) is resolved.
		'--foreground-scripts=false',
	], {cwd: rootDirectory});

	try {
		// HACK: NPM lifecycle scripts can output text even with --silent and --foreground-scripts=false.
		// For example, Husky's prepare script outputs "> package@version prepare" and "> husky install".
		// We extract only the JSON portion by finding the first '[' character.
		// Related: https://github.com/sindresorhus/np/issues/742
		const {files} = JSON.parse(stdout.slice(Math.max(0, stdout.indexOf('[')))).at(0);
		return files.map(file => file.path);
	} catch (error) {
		throw new Error('Failed to parse output of npm pack', {cause: error});
	}
};

const isValidEntryPoint = value => typeof value === 'string' && !value.includes('*');

const getExportsFiles = exports => {
	const files = [];

	const extract = value => {
		if (isValidEntryPoint(value)) {
			files.push(value);
		} else if (typeof value === 'object' && value !== null) {
			for (const subvalue of Object.values(value)) {
				extract(subvalue);
			}
		}
	};

	extract(exports);
	return files;
};

export const getPackageEntryPoints = package_ => {
	const entryPoints = [];

	if (isValidEntryPoint(package_.main)) {
		entryPoints.push({field: 'main', path: package_.main});
	}

	if (typeof package_.bin === 'string') {
		if (isValidEntryPoint(package_.bin)) {
			entryPoints.push({field: 'bin', path: package_.bin});
		}
	} else if (typeof package_.bin === 'object' && package_.bin !== null) {
		for (const [name, binPath] of Object.entries(package_.bin)) {
			if (isValidEntryPoint(binPath)) {
				entryPoints.push({field: `bin.${name}`, path: binPath});
			}
		}
	}

	if (package_.exports) {
		for (const file of getExportsFiles(package_.exports)) {
			entryPoints.push({field: 'exports', path: file});
		}
	}

	return entryPoints;
};

export const verifyPackageEntryPoints = async (package_, rootDirectory) => {
	const packedFiles = new Set(await getFilesToBePacked(rootDirectory));
	const entryPoints = getPackageEntryPoints(package_);

	const seenPaths = new Set();
	const missingEntryPoints = [];

	for (const entryPoint of entryPoints) {
		const normalizedPath = entryPoint.path.replace(/^\.\//, '');

		if (seenPaths.has(normalizedPath)) {
			continue;
		}

		seenPaths.add(normalizedPath);

		if (!packedFiles.has(normalizedPath)) {
			missingEntryPoints.push(entryPoint);
		}
	}

	if (missingEntryPoints.length > 0) {
		const missing = missingEntryPoints.map(({field, path: entryPath}) => `  "${field}": ${entryPath}`).join('\n');
		throw new Error(`Missing entry points in published files:\n${missing}\n\nEnsure these files exist and are included in the "files" field.`);
	}
};

export const getPublishedPackageEngines = async package_ => {
	const arguments_ = ['view', '--json', package_.name, 'engines'];

	if (package_.publishConfig?.registry) {
		arguments_.push('--registry', package_.publishConfig.registry);
	}

	try {
		const {stdout} = await execa('npm', arguments_, {timeout: npmNetworkTimeout});

		// Handle empty response (package exists but has no engines field)
		if (stdout.trim() === '') {
			return undefined;
		}

		return JSON.parse(stdout);
	} catch (error) {
		throwIfNpmTimeout(error);

		// Package doesn't exist yet (first publish)
		if (error.stderr?.includes('E404')) {
			return undefined;
		}

		// External registries often don't support this endpoint, so ignore errors.
		// See: https://github.com/sindresorhus/np/issues/420
		if (isExternalRegistry(package_)) {
			return undefined;
		}

		throw error;
	}
};
