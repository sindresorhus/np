'use strict';
const semver = require('semver');

exports.SEMVER_INCREMENTS = ['patch', 'minor', 'major', 'prepatch', 'preminor', 'premajor', 'prerelease'];
exports.PRERELEASE_VERSIONS = ['prepatch', 'preminor', 'premajor', 'prerelease'];

const isValidVersion = input => Boolean(semver.valid(input));

exports.isValidVersionInput = input => exports.SEMVER_INCREMENTS.includes(input) || isValidVersion(input);

exports.isPrereleaseVersion = version => exports.PRERELEASE_VERSIONS.includes(version) || Boolean(semver.prerelease(version));

exports.getNewVersion = (oldVersion, input) => {
	if (!exports.isValidVersionInput(input)) {
		throw new Error(`Version should be either ${exports.SEMVER_INCREMENTS.join(', ')} or a valid semver version.`);
	}

	return exports.SEMVER_INCREMENTS.includes(input) ? semver.inc(oldVersion, input) : input;
};

exports.validateVersion = version => {
	if (!isValidVersion(version)) {
		throw new Error('Version should be a valid semver version.');
	}
};

exports.isGreaterThanOrEqualTo = (firstVersion, secondVersion) => {
	exports.validateVersion(secondVersion);
	return semver.gte(secondVersion, firstVersion);
};

exports.isLowerThanOrEqualTo = (firstVersion, secondVersion) => {
	exports.validateVersion(secondVersion);
	return semver.lte(secondVersion, firstVersion);
};

exports.satisfies = (version, range) => semver.satisfies(version, range, {
	includePrerelease: true
});
