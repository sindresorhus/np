'use strict';
const semver = require('semver');

class Version {
	constructor(version) {
		this.version = version;
	}

	isPrerelease() {
		return Boolean(semver.prerelease(this.version));
	}

	satisfies(range) {
		module.exports.validate(this.version);
		return semver.satisfies(this.version, range, {
			includePrerelease: true
		});
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

module.exports.isPrereleaseOrIncrement = input => module.exports(input).isPrerelease() || module.exports.PRERELEASE_VERSIONS.includes(input);

const isValidVersion = input => Boolean(semver.valid(input));

module.exports.isValidInput = input => module.exports.SEMVER_INCREMENTS.includes(input) || isValidVersion(input);

module.exports.validate = version => {
	if (!isValidVersion(version)) {
		throw new Error('Version should be a valid semver version.');
	}
};

module.exports.verifyRequirementSatisfied = (dependency, version) => {
	const depRange = require('../package.json').engines[dependency];
	if (!module.exports(version).satisfies(depRange)) {
		throw new Error(`Please upgrade to ${dependency}${depRange}`);
	}
};
