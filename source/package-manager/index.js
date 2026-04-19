import fs from 'node:fs';
import path from 'node:path';
import semver from 'semver';
import * as configs from './configs.js';

/**
@param {string} rootDirectory
@param {import('./types.d.ts').PackageManagerConfig} config
*/
export function findLockfile(rootDirectory, config) {
	return config.lockfiles
		.map(filename => path.resolve(rootDirectory || '.', filename))
		.find(filepath => fs.existsSync(filepath));
}

/**
@param {string} rootDirectory
@param {import('read-pkg').NormalizedPackageJson} package_
*/
export function getPackageManagerConfig(rootDirectory, package_) {
	const config = configFromPackageManagerField(package_) ?? configFromDevEnginesPackageManager(package_);
	return config || configFromLockfile(rootDirectory) || configs.npmConfig;
}

/** @param {import('read-pkg').NormalizedPackageJson} package_ */
function configFromPackageManagerField(package_) {
	if (typeof package_.packageManager !== 'string') {
		return undefined;
	}

	const [packageManager, version] = package_.packageManager.split('@');

	return configFromPackageManager(packageManager, version, package_.packageManager);
}

/** @param {import('read-pkg').NormalizedPackageJson} package_ */
function configFromDevEnginesPackageManager(package_) {
	const {packageManager} = package_.devEngines ?? {};
	const packageManagers = Array.isArray(packageManager) ? packageManager : [packageManager];

	for (const packageManager of packageManagers) {
		if (!packageManager || typeof packageManager !== 'object' || !('name' in packageManager) || typeof packageManager.name !== 'string') {
			continue;
		}

		const version = typeof packageManager.version === 'string' ? packageManager.version : undefined;
		return configFromPackageManager(packageManager.name, version, packageManager.name);
	}
}

function configFromPackageManager(packageManager, version, rawPackageManager) {
	const minimumVersion = version && semver.minVersion(version);

	if (packageManager === 'yarn' && minimumVersion && semver.gte(minimumVersion, '2.0.0')) {
		return configs.yarnBerryConfig;
	}

	if (packageManager === 'npm') {
		return configs.npmConfig;
	}

	if (packageManager === 'pnpm') {
		return configs.pnpmConfig;
	}

	if (packageManager === 'yarn') {
		return configs.yarnConfig;
	}

	if (packageManager === 'bun') {
		return configs.bunConfig;
	}

	throw new Error(`Invalid package manager: ${rawPackageManager}`);
}

/** @param {string} rootDirectory */
function configFromLockfile(rootDirectory, options = [configs.npmConfig, configs.pnpmConfig, configs.yarnConfig]) {
	const foundConfig = options.find(config => findLockfile(rootDirectory, config));

	// If yarn.lock is found, check if it's Yarn Berry by looking for .yarnrc.yml
	if (foundConfig === configs.yarnConfig) {
		const yarnrcYmlPath = path.resolve(rootDirectory || '.', '.yarnrc.yml');
		if (fs.existsSync(yarnrcYmlPath)) {
			return configs.yarnBerryConfig;
		}
	}

	return foundConfig;
}

/** @param {import('./types.d.ts').Command} command */
export function printCommand([cli, arguments_]) {
	return `${cli} ${arguments_.join(' ')}`;
}
