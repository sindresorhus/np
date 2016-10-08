'use strict';
const semver = require('semver');

exports.SEMVER_INCREMENTS = ['patch', 'minor', 'major', 'prepatch', 'preminor', 'premajor', 'prerelease'];
exports.PRERELEASE_VERSIONS = ['prepatch', 'preminor', 'premajor', 'prerelease'];

function isValidVersion(input) {
	return Boolean(semver.valid(input));
}

exports.isValidVersionInput = function isValidVersionInput(input) {
	return exports.SEMVER_INCREMENTS.indexOf(input) !== -1 || isValidVersion(input);
};

exports.isPrereleaseVersion = function isPrereleaseVersion(version) {
	return exports.PRERELEASE_VERSIONS.indexOf(version) !== -1 || Boolean(semver.prerelease(version));
};

exports.getNewVersion = function getNewVersion(oldVersion, input) {
	if (!exports.isValidVersionInput(input)) {
		throw new Error(`Version should be either ${exports.SEMVER_INCREMENTS.join(', ')} or a valid semver version.`);
	}
	return exports.SEMVER_INCREMENTS.indexOf(input) === -1 ? input : semver.inc(oldVersion, input);
};

exports.isVersionGreater = function isGreater(oldVersion, newVersion) {
	if (!isValidVersion(newVersion)) {
		throw new Error('Version should be a valid semver version.');
	}
	return semver.gt(newVersion, oldVersion);
};

exports.isVersionLower = function isVersionLower(oldVersion, newVersion) {
	if (!isValidVersion(newVersion)) {
		throw new Error('Version should be a valid semver version.');
	}
	return semver.lt(newVersion, oldVersion);
};

exports.satisfies = function satisfies(version, range) {
	return semver.satisfies(version, range);
};
