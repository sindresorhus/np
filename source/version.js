import semver from 'semver';
import {template as chalk} from 'chalk-template';

export const SEMVER_INCREMENTS = semver.RELEASE_TYPES.sort();
const SEMVER_INCREMENTS_LIST = `\`${SEMVER_INCREMENTS.join('`, `')}\``;

/** @typedef {semver.SemVer} SemVerInstance */
/** @typedef {semver.ReleaseType} SemVerIncrement */

/** @param {string} input @returns {input is SemVerIncrement} */
const isSemVerIncrement = input => SEMVER_INCREMENTS.includes(input);

const isInvalidSemVerVersion = input => Boolean(!semver.valid(input));

export default class Version {
	/** @type {SemVerInstance} */
	#version;

	/** @type {SemVerIncrement | undefined} */
	diff = undefined;

	get version() {
		return this.#version.version;
	}

	set version(version) {
		this.#version = semver.parse(version);

		if (this.#version === null) {
			// TODO: maybe make a custom InvalidSemVerError?
			// TODO: linkify '`SemVer` version'
			throw new Error(`Version \`${version}\` should be a valid \`SemVer\` version.`);
		}
	}

	/**
	@param {string} version - A valid `SemVer` version.
	@param {SemVerIncrement} [increment] - Optionally increment `version`. If valid, `Version.diff` will be defined as the difference between `version` and the new version.
	*/
	constructor(version, increment) {
		this.version = version;

		if (increment) {
			if (!isSemVerIncrement(increment)) {
				throw new Error(`Increment \`${increment}\` should be one of ${SEMVER_INCREMENTS_LIST}.`);
			}

			this.setFrom(increment);
		}
	}

	/**
	Sets a new version based on `input`. If `input` is a valid `SemVer` increment, `Version.version` will be incrememnted by that amount and `Version.diff` will be set to `input`. If `input` is a valid `SemVer` version, `Version.version` will be set to `input` if it is greater than the current version,

	@param {string | SemVerIncrement} input - A new valid `SemVer` version or a `SemVer` increment to increase the current version by.
	@throws If `input` is not a valid `SemVer` version or increment, or if `input` is a valid `SemVer` version but is not greater than the current version.
	*/
	setFrom(input) {
		// Use getter - reference may change
		const oldVersion = this.version;

		if (isSemVerIncrement(input)) {
			this.#version.inc(input);
		} else {
			if (isInvalidSemVerVersion(input)) {
				throw new Error(`New version \`${input}\` should either be one of ${SEMVER_INCREMENTS_LIST}, or a valid \`SemVer\` version.`);
			}

			if (this.#isGreaterThanOrEqualTo(input)) {
				throw new Error(`New version \`${input}\` should be higher than current version \`${this.version}\`.`);
			}

			this.version = input;
		}

		this.diff = semver.diff(oldVersion, this.#version);
		return this;
	}

	// TODO: test custom colors
	format(color = 'dim', {diffColor = 'cyan'} = {}) {
		if (!this.diff) {
			return chalk(`{${color} ${this.version}}`);
		}

		const {major, minor, patch, prerelease} = this.#version;

		/* eslint-disable indent, unicorn/no-nested-ternary, operator-linebreak, no-multi-spaces */
		return (
			this.diff === 'major'      ? chalk(`{${color} {${diffColor} ${major}}.${minor}.${patch}}`) :
			this.diff === 'minor'      ? chalk(`{${color} ${major}.{${diffColor} ${minor}}.${patch}}`) :
			this.diff === 'patch'      ? chalk(`{${color} ${major}.${minor}.{${diffColor} ${patch}}}`) :
			this.diff === 'premajor'   ? chalk(`{${color} {${diffColor} ${major}}.${minor}.${patch}-{${diffColor} ${prerelease.join('.')}}}`) : // TODO: handle prerelease diffs
			this.diff === 'preminor'   ? chalk(`{${color} ${major}.{${diffColor} ${minor}}.${patch}-{${diffColor} ${prerelease.join('.')}}}`) :
			this.diff === 'prepatch'   ? chalk(`{${color} ${major}.${minor}.{${diffColor} ${patch}}-{${diffColor} ${prerelease.join('.')}}}`) :
			this.diff === 'prerelease' ? chalk(`{${color} ${major}.${minor}.${patch}-{${diffColor} ${prerelease.join('.')}}}`) : '' // TODO: throw error if somehow invalid????
		);
		/* eslint-enable indent, unicorn/no-nested-ternary, operator-linebreak, no-multi-spaces */
	}

	satisfies(range) {
		// TODO: validate range?
		return semver.satisfies(this.version, range, {
			includePrerelease: true,
		});
	}

	isPrerelease() {
		return Boolean(semver.prerelease(this.#version));
	}

	#isGreaterThanOrEqualTo(otherVersion) {
		return semver.gte(this.#version, otherVersion);
	}
}
