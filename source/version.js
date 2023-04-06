import semver from 'semver';
import {readPackageUp} from 'read-pkg-up';

const {packageJson: pkg} = await readPackageUp();

export default class Version {
	constructor(version) {
		this.version = version;
	}

	isPrerelease() {
		return Boolean(semver.prerelease(this.version));
	}

	// TODO: should this be validated? it's after `getNewVersionFrom` in tasks
	// add test in test/version.js
	isMajor(input) {
		return semver.diff(this.version, input) === 'major';
	}

	satisfies(range) {
		Version.validate(this.version);
		return semver.satisfies(this.version, range, {
			includePrerelease: true,
		});
	}

	getNewVersionFrom(input) {
		Version.validate(this.version);
		if (!Version.isValidInput(input)) {
			throw new Error(`Version should be either ${Version.SEMVER_INCREMENTS.join(', ')}, or a valid semver version.`);
		}

		return Version.SEMVER_INCREMENTS.includes(input) ? semver.inc(this.version, input) : input;
	}

	isGreaterThanOrEqualTo(otherVersion) {
		Version.validate(this.version);
		Version.validate(otherVersion);

		return semver.gte(otherVersion, this.version);
	}

	isLowerThanOrEqualTo(otherVersion) {
		Version.validate(this.version);
		Version.validate(otherVersion);

		return semver.lte(otherVersion, this.version);
	}

	static SEMVER_INCREMENTS = ['patch', 'minor', 'major', 'prepatch', 'preminor', 'premajor', 'prerelease'];
	static PRERELEASE_VERSIONS = ['prepatch', 'preminor', 'premajor', 'prerelease'];

	static isPrereleaseOrIncrement = input => new Version(input).isPrerelease() || Version.PRERELEASE_VERSIONS.includes(input);

	static isValidVersion = input => Boolean(semver.valid(input));

	static isValidInput = input => Version.SEMVER_INCREMENTS.includes(input) || Version.isValidVersion(input);

	static validate(version) {
		if (!Version.isValidVersion(version)) {
			throw new Error('Version should be a valid semver version.');
		}
	}

	static verifyRequirementSatisfied(dependency, version) {
		const depRange = pkg.engines[dependency];
		if (!new Version(version).satisfies(depRange)) {
			throw new Error(`Please upgrade to ${dependency}${depRange}`);
		}
	}

	static getAndValidateNewVersionFrom(input, version) {
		const newVersion = new Version(version).getNewVersionFrom(input);

		if (new Version(version).isLowerThanOrEqualTo(newVersion)) {
			throw new Error(`New version \`${newVersion}\` should be higher than current version \`${version}\``);
		}

		return newVersion;
	}
}
