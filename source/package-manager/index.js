import fs from 'node:fs';
import path from 'node:path';
import semver from 'semver';
import {npmConfig, yarnBerryConfig, pnpmConfig, yarnConfig} from './configs.js';

/**
@param {string} rootDir
@param {import('./types.d.ts').PackageManagerConfig} config
*/
export function findLockFile(rootDir, config) {
	return config.lockfiles
		.map(filename => ({filename, filepath: path.resolve(rootDir || '.', filename)}))
		.find(({filepath}) => fs.existsSync(filepath));
}

/**
@param {string} rootDir
@param {import('read-pkg').NormalizedPackageJson} pkg
*/
export function getPackageManagerConfig(rootDir, pkg) {
	const config = configFromPackageManagerField(pkg);
	return config || configFromLockfile(rootDir) || npmConfig;
}

/** @param {import('read-pkg').NormalizedPackageJson} pkg */
function configFromPackageManagerField(pkg) {
	if (typeof pkg.packageManager !== 'string') {
		return undefined;
	}

	const [packageManager, version] = pkg.packageManager.split('@');

	if (packageManager === 'yarn' && version && semver.gte(version, '2.0.0')) {
		return yarnBerryConfig;
	}

	if (packageManager === 'npm') {
		return npmConfig;
	}

	if (packageManager === 'pnpm') {
		return pnpmConfig;
	}

	if (packageManager === 'yarn') {
		return yarnConfig;
	}

	throw new Error(`Invalid package manager: ${pkg.packageManager}`);
}

/** @param {string} rootDir */
function configFromLockfile(rootDir, options = [npmConfig, pnpmConfig, yarnConfig]) {
	return options.find(config => findLockFile(rootDir, config));
}

/** @param {import('./types.d.ts').Command} command */
export function printCommand([cli, args]) {
	return `${cli} ${args.join(' ')}`;
}
