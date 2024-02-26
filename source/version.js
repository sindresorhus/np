import semver from 'semver';
import {template as chalk} from 'chalk-template';

/** @type {string[]} Allowed `SemVer` release types. */
export const SEMVER_INCREMENTS = ['patch', 'minor', 'major', 'prepatch', 'preminor', 'premajor', 'prerelease'];
export const SEMVER_INCREMENTS_LIST = SEMVER_INCREMENTS.join(', ');
const SEMVER_INCREMENTS_LIST_LAST_OR = `${SEMVER_INCREMENTS.slice(0, -1).join(', ')}, or ${SEMVER_INCREMENTS.slice(-1)}`;

/** @typedef {semver.SemVer} SemVerInstance */
/** @typedef {semver.ReleaseType} SemVerIncrement */
/** @typedef {import('chalk').ColorName | import('chalk').ModifierName} ColorName */

/** @param {string} input @returns {input is SemVerIncrement} */
const isSemVersionIncrement = input => SEMVER_INCREMENTS.includes(input);

/** @param {string} input */
const isInvalidSemVersion = input => Boolean(!semver.valid(input));

/**
Formats the first difference between two versions to the given `diffColor`. Useful for `prerelease` diffs.

@param {string[]} current @param {string[]} previous @param {ColorName} diffColor
*/
const formatFirstDifference = (current, previous, diffColor) => {
	const firstDifferenceIndex = current.findIndex((part, i) => previous.at(i) !== part);
	current[firstDifferenceIndex] = `{${diffColor} ${current.at(firstDifferenceIndex)}}`;
	return current.join('.');
};

export default class Version {
	/** @type {SemVerInstance} */
	#version;

	/** @type {SemVerIncrement | undefined} */
	#diff = undefined;

	/** @type {string | undefined} */
	#prereleasePrefix = undefined;

	toString() {
		return this.#version.version;
	}

	/**
	Sets `this.#version` to the given version.

	@param {string} version
	@throws If `version` is an invalid `SemVer` version.
	*/
	#trySetVersion(version) {
		this.#version = semver.parse(version);

		if (this.#version === null) {
			throw new Error(`Version ${version} should be a valid SemVer version.`);
		}
	}

	/**
	@param {string} version - A valid `SemVer` version.
	@param {SemVerIncrement} [increment] - Optionally increment `version`.
	@param {object} [options]
	@param {string} [options.prereleasePrefix] - A prefix to use for `prerelease` versions.
	*/
	constructor(version, increment, {prereleasePrefix} = {}) {
		this.#prereleasePrefix = prereleasePrefix;
		this.#trySetVersion(version);

		if (increment) {
			if (!isSemVersionIncrement(increment)) {
				throw new Error(`Increment ${increment} should be one of ${SEMVER_INCREMENTS_LIST_LAST_OR}.`);
			}

			this.setFrom(increment);
		}
	}

	/**
	Sets a new version based on `input`. If `input` is a valid `SemVer` increment, the current version will be incremented by that amount. If `input` is a valid `SemVer` version, the current version will be set to `input` if it is greater than the current version.

	@param {string | SemVerIncrement} input - A new valid `SemVer` version or a `SemVer` increment to increase the current version by.
	@param {object} [options]
	@param {string} [options.prereleasePrefix] - A prefix to use for `prerelease` versions.
	@throws If `input` is not a valid `SemVer` version or increment, or if `input` is a valid `SemVer` version but is not greater than the current version.
	*/
	setFrom(input, {prereleasePrefix = ''} = {}) {
		this.#prereleasePrefix ??= prereleasePrefix;
		const previousVersion = this.toString();

		if (isSemVersionIncrement(input)) {
			this.#version.inc(input, this.#prereleasePrefix);
		} else {
			if (isInvalidSemVersion(input)) {
				throw new Error(`New version ${input} should either be one of ${SEMVER_INCREMENTS_LIST}, or a valid SemVer version.`);
			}

			if (this.#isGreaterThanOrEqualTo(input)) {
				throw new Error(`New version ${input} should be higher than current version ${this.toString()}.`);
			}

			this.#trySetVersion(input);
		}

		// Set `this.#diff` to format version diffs
		this.#diff = semver.diff(previousVersion, this.#version);
		return this;
	}

	/**
	Formats the current version with `options.color`, pretty-printing the version's diff with `options.diffColor` if possible.

	If the current version has never been changed, providing `options.previousVersion` will allow pretty-printing the diff. It must be provided to format diffs between `prerelease` versions.

	@param {object} options
	@param {ColorName} [options.color = 'dim']
	@param {ColorName} [options.diffColor = 'cyan']
	@param {string} [options.prereleasePrefix]
	@returns {string} A color-formatted version string.
	*/
	format({color = 'dim', diffColor = 'cyan', previousVersion} = {}) {
		if (typeof previousVersion === 'string') {
			const previousSemver = semver.parse(previousVersion);

			if (previousSemver === null) {
				throw new Error(`Previous version ${previousVersion} should be a valid SemVer version.`);
			}

			previousVersion = previousSemver;
		}

		if (!this.#diff) {
			if (!previousVersion) {
				return chalk(`{${color} ${this.toString()}}`);
			}

			this.#diff = semver.diff(previousVersion, this.#version);
		}

		const {major, minor, patch, prerelease} = this.#version;
		const previousPrerelease = semver.prerelease(previousVersion);

		if (prerelease && previousPrerelease) {
			const prereleaseDiff = formatFirstDifference(prerelease, previousPrerelease, diffColor);
			return chalk(`{${color} ${major}.${minor}.${patch}-${prereleaseDiff}}`);
		}

		/* eslint-disable indent, unicorn/no-nested-ternary, operator-linebreak, no-multi-spaces */
		return (
			this.#diff === 'major'      ? chalk(`{${color} {${diffColor} ${major}}.${minor}.${patch}}`) :
			this.#diff === 'minor'      ? chalk(`{${color} ${major}.{${diffColor} ${minor}}.${patch}}`) :
			this.#diff === 'patch'      ? chalk(`{${color} ${major}.${minor}.{${diffColor} ${patch}}}`) :
			this.#diff === 'premajor'   ? chalk(`{${color} {${diffColor} ${major}}.${minor}.${patch}-{${diffColor} ${prerelease.join('.')}}}`) :
			this.#diff === 'preminor'   ? chalk(`{${color} ${major}.{${diffColor} ${minor}}.${patch}-{${diffColor} ${prerelease.join('.')}}}`) :
			this.#diff === 'prepatch'   ? chalk(`{${color} ${major}.${minor}.{${diffColor} ${patch}}-{${diffColor} ${prerelease.join('.')}}}`) :
			this.#diff === 'prerelease' ? chalk(`{${color} ${major}.${minor}.${patch}-{${diffColor} ${prerelease.join('.')}}}`) : ''
		);
		/* eslint-enable indent, unicorn/no-nested-ternary, operator-linebreak, no-multi-spaces */
	}

	/**
	If the current version satisifes the given `SemVer` range.

	@param {string} range
	@throws If `range` is invalid.
	*/
	satisfies(range) {
		if (!semver.validRange(range)) {
			throw new Error(`Range ${range} is not a valid SemVer range.`);
		}

		return semver.satisfies(this.#version, range, {
			includePrerelease: true,
		});
	}

	/**
	If the current version has any `prerelease` components.
	*/
	isPrerelease() {
		return Boolean(semver.prerelease(this.#version));
	}

	/**
	If the current version is the same as or higher than the given version.

	@param {string} otherVersion
	*/
	#isGreaterThanOrEqualTo(otherVersion) {
		return semver.gte(this.#version, otherVersion);
	}
}
