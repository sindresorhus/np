'use strict';
const semver = require('semver');
const pkg = require('../package.json');

const requirements = pkg.engines;

class Version {
	constructor(version) {
		this.version = version;
	}

	isPrerelease() {
		return module.exports.PRERELEASE_VERSIONS.includes(this.version) || Boolean(semver.prerelease(this.version));
	}

	satisfies(range) {
		return satisfies(this.version, range);
	}

	getNewVersionFrom(input) {
		module.exports.validate(this.version);
		if (!module.exports.isValidInput(input)) {
			throw new Error(`Version should be either ${module.exports.SEMVER_INCREMENTS.join(', ')} or a valid semver version.`);
		}

		return module.exports.SEMVER_INCREMENTS.includes(input) ? semver.inc(this.version, input) : input;
	}

	isGreaterThanOrEqualTo(otherVersion) {
		module.exports.validate(this.version);
		module.exports.validate(otherVersion);

		return semver.gte(otherVersion, this.version);
	}

	isLowerThanOrEqualTo(otherVersion) {
		module.exports.validate(this.version);
		module.exports.validate(otherVersion);

		return semver.lte(otherVersion, this.version);
	}
}

module.exports = version => new Version(version);

module.exports.SEMVER_INCREMENTS = ['patch', 'minor', 'major', 'prepatch', 'preminor', 'premajor', 'prerelease'];
module.exports.PRERELEASE_VERSIONS = ['prepatch', 'preminor', 'premajor', 'prerelease'];

const isValidVersion = input => Boolean(semver.valid(input));

module.exports.isValidInput = input => module.exports.SEMVER_INCREMENTS.includes(input) || isValidVersion(input);

module.exports.validate = version => {
	if (!isValidVersion(version)) {
		throw new Error('Version should be a valid semver version.');
	}
};

module.exports.satisfiesRequiredVersion = async function (pkgName, installedVersion) {
	const range = requirements[pkgName];
	if (!satisfies(installedVersion, range)) {
		throw new Error(`Please upgrade ${pkgName} to ${range} or higher.`);
	}
};

/**
 * Check whether the given version satisfies the range
 * @private
 * @param {string} version to check
 * @param {string} range to check
 * @returns {boolean} true if satisfies
 */
function satisfies(version, range) {
	module.exports.validate(version);
	return semver.satisfies(version, range, {
		includePrerelease: true
	});
}
