import chalkTemplate from 'chalk-template';
import semver from 'semver';
import Version from './version.js';

const prettyVersionDiff = (oldVersion, inc) => {
	const newVersion = new Version(oldVersion).getNewVersionFrom(inc);
	const {major, minor, patch, prerelease} = Version.getPartsOf(newVersion);
	const diff = semver.diff(oldVersion, newVersion);

	/* eslint-disable indent, unicorn/no-nested-ternary, operator-linebreak */
	return (
		diff === 'major' ? chalkTemplate`{dim {cyan ${major}}.${minor}.${patch}}` :
		diff === 'minor' ? chalkTemplate`{dim ${major}.{cyan ${minor}}.${patch}}` :
		diff === 'patch' ? chalkTemplate`{dim ${major}.${minor}.{cyan ${patch}}}` :
		diff === 'premajor' ? chalkTemplate`{dim {cyan ${major}}.${minor}.${patch}-{cyan ${prerelease.join('.')}}}` :
		diff === 'preminor' ? chalkTemplate`{dim ${major}.{cyan ${minor}}.${patch}-{cyan ${prerelease.join('.')}}}` :
		diff === 'prepatch' ? chalkTemplate`{dim ${major}.${minor}.{cyan ${patch}}-{cyan ${prerelease.join('.')}}}` :
		diff === 'prerelease' ? chalkTemplate`{dim ${major}.${minor}.${patch}-{cyan ${prerelease.join('.')}}}` : ''
		// TODO: handle prepatch being the same as prerelease
	);
	/* eslint-enable indent, unicorn/no-nested-ternary, operator-linebreak */
};

export default prettyVersionDiff;
