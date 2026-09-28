import test from 'node:test';
import assert from 'node:assert/strict';
import sinon from 'sinon';
import {template as chalk} from 'chalk-template';
import semver from 'semver';
import Version from '../source/version.js';

const INCREMENT_LIST = 'patch, minor, major, prepatch, preminor, premajor, prerelease';
const INCREMENT_LIST_OR = 'patch, minor, major, prepatch, preminor, premajor, or prerelease';

/**
Creates a chalk-formatted version string with highlighted parts.
@param {string} input - Place `{ }` around the version parts to be highlighted.
*/
const makeNewFormattedVersion = input => {
	// eslint-disable-next-line regexp/no-super-linear-move -- [^\}]* is maximally exclusive and cannot backtrack; input is test-generated, not user data
	input = input.replaceAll(/\{(?<content>[^\}]*)\}/gv, '{cyan $<content>}'); // https://regex101.com/r/rZUIp4/1
	return chalk(`{dim ${input}}`);
};

test('new Version - valid', () => {
	assert.equal(new Version('1.0.0').toString(), '1.0.0');
});

test('new Version - invalid', () => {
	assert.throws(
		() => new Version('major'),
		{message: 'Version major should be a valid SemVer version.'},
	);
});

test('new Version - valid w/ valid increment', () => {
	assert.equal(new Version('1.0.0', 'major').toString(), '2.0.0');
});

test('new Version - invalid w/ valid increment', () => {
	assert.throws(
		() => new Version('major', 'major'),
		{message: 'Version major should be a valid SemVer version.'},
	);
});

test('new Version - valid w/ invalid increment', () => {
	assert.throws(
		() => new Version('1.0.0', '2.0.0'),
		{message: `Increment 2.0.0 should be one of ${INCREMENT_LIST_OR}.`},
	);
});

test('new Version - invalid w/ invalid increment', () => {
	assert.throws(
		() => new Version('major', '2.0.0'),
		{message: 'Version major should be a valid SemVer version.'},
	);
});

// Input as SemVer increment is covered in constructor tests
test('setFrom - valid input as version', () => {
	assert.equal(new Version('1.0.0').setFrom('2.0.0').toString(), '2.0.0');
});

test('setFrom - invalid input as version', () => {
	assert.throws(
		() => new Version('1.0.0').setFrom('200'),
		{message: `New version 200 should either be one of ${INCREMENT_LIST}, or a valid SemVer version.`},
	);
});

test('setFrom - valid input is not higher than version', () => {
	assert.throws(
		() => new Version('1.0.0').setFrom('0.2.0'),
		{message: 'New version 0.2.0 should be higher than current version 1.0.0.'},
	);
});

test('format', () => {
	assert.equal(new Version('0.0.0').format(), makeNewFormattedVersion('0.0.0'));
});

test('format - same previous version', () => {
	// `semver.diff` is `null` for equal versions, so nothing was highlighted and the whole
	// version formatted to an empty string.
	assert.equal(
		new Version('1.0.0').format({previousVersion: '1.0.0'}),
		makeNewFormattedVersion('1.0.0'),
	);
});

test('format - set diff', () => {
	assert.equal(
		new Version('1.0.0').format({previousVersion: '0.0.0'}),
		makeNewFormattedVersion('{1}.0.0'),
	);
});

test('format - major', () => {
	const newVersion = makeNewFormattedVersion('{1}.0.0');

	assert.equal(new Version('0.0.0').setFrom('major').format(), newVersion);
	assert.equal(new Version('0.0.0').setFrom('1.0.0').format(), newVersion);
});

test('format - minor', () => {
	const newVersion = makeNewFormattedVersion('0.{1}.0');

	assert.equal(new Version('0.0.0').setFrom('minor').format(), newVersion);
	assert.equal(new Version('0.0.0').setFrom('0.1.0').format(), newVersion);
});

test('format - patch', () => {
	const newVersion = makeNewFormattedVersion('0.0.{1}');

	assert.equal(new Version('0.0.0').setFrom('patch').format(), newVersion);
	assert.equal(new Version('0.0.0').setFrom('0.0.1').format(), newVersion);
});

test('format - premajor', () => {
	const newVersion = makeNewFormattedVersion('{1}.0.0-{0}');

	assert.equal(new Version('0.0.0').setFrom('premajor').format(), newVersion);
	assert.equal(new Version('0.0.0').setFrom('1.0.0-0').format(), newVersion);
});

test('format - preminor', () => {
	const newVersion = makeNewFormattedVersion('0.{1}.0-{0}');

	assert.equal(new Version('0.0.0').setFrom('preminor').format(), newVersion);
	assert.equal(new Version('0.0.0').setFrom('0.1.0-0').format(), newVersion);
});

test('format - prepatch', () => {
	const newVersion = makeNewFormattedVersion('0.0.{1}-{0}');

	assert.equal(new Version('0.0.0').setFrom('prepatch').format(), newVersion);
	assert.equal(new Version('0.0.0').setFrom('0.0.1-0').format(), newVersion);
});

test('format - prerelease', () => {
	const newVersion = makeNewFormattedVersion('0.0.0-{1}');

	assert.equal(new Version('0.0.0-0').setFrom('prerelease').format(), newVersion);
	assert.equal(new Version('0.0.0-0').setFrom('0.0.0-1').format(), newVersion);
});

test('format - prerelease as prepatch', () => {
	const newVersion = makeNewFormattedVersion('0.0.{1}-{0}');

	assert.equal(new Version('0.0.0').setFrom('prerelease').format(), newVersion);
	assert.equal(new Version('0.0.0').setFrom('0.0.1-0').format(), newVersion);
});

test('format - prerelease with multiple numbers', () => {
	const newVersion = makeNewFormattedVersion('0.0.{1}-{0.0}');
	assert.equal(new Version('0.0.0').setFrom('0.0.1-0.0').format(), newVersion);
});

test('format - prerelease with text', () => {
	const newVersion = makeNewFormattedVersion('0.0.{1}-{alpha.0}');
	assert.equal(new Version('0.0.0').setFrom('0.0.1-alpha.0').format(), newVersion);
});

test('format - prerelease diffs', () => {
	const newVersion = makeNewFormattedVersion('0.0.0-1.{2}');

	assert.equal(
		new Version('0.0.0-1.1').setFrom('0.0.0-1.2').format({previousVersion: '0.0.0-1.1'}),
		newVersion,
	);

	assert.equal(
		new Version('0.0.0-1.2').format({previousVersion: '0.0.0-1.1'}),
		newVersion,
	);
});

test('format - custom colors', () => {
	assert.equal(
		new Version('1.2.3').format({color: 'green'}),
		chalk('{green 1.2.3}'),
	);

	assert.equal(
		new Version('1.2.3', 'minor').format({diffColor: 'red'}),
		chalk('{dim 1.{red 3}.0}'),
	);

	assert.equal(
		new Version('1.2.3', 'patch').format({color: 'bgBlack.red', diffColor: 'yellow'}),
		chalk('{bgBlack.red 1.2.{yellow 4}}'),
	);

	assert.equal(
		new Version('1.2.3', 'prerelease').format({color: 'bgBlack.red', diffColor: 'yellow'}),
		chalk('{bgBlack.red 1.2.{yellow 4}-{yellow 0}}'),
	);
});

test('format - previousVersion as SemVer instance', () => {
	const previousVersion = semver.parse('0.0.0');
	const newVersion = makeNewFormattedVersion('{1}.0.0');

	const spy = sinon.spy(semver, 'parse');

	assert.equal(new Version('1.0.0').format({previousVersion}), newVersion);
	assert.ok(spy.calledOnce, 'semver.parse was called for previousVersion!');

	spy.resetHistory();

	assert.equal(new Version('1.0.0').format({previousVersion: '0.0.0'}), newVersion);
	assert.ok(spy.calledTwice, 'semver.parse was not called for previousVersion!');
});

test('format - invalid previousVersion', () => {
	assert.throws(
		() => new Version('1.0.0').format({previousVersion: '000'}),
		{message: 'Previous version 000 should be a valid SemVer version.'},
	);
});

test('satisfies', () => {
	assert.ok(new Version('2.15.8').satisfies('>=2.15.8 <3.0.0 || >=3.10.1'));
	assert.ok(new Version('2.99.8').satisfies('>=2.15.8 <3.0.0 || >=3.10.1'));
	assert.ok(new Version('3.10.1').satisfies('>=2.15.8 <3.0.0 || >=3.10.1'));
	assert.ok(new Version('6.7.0-next.0').satisfies('<6.8.0'));

	assert.ok(!(new Version('3.0.0').satisfies('>=2.15.8 <3.0.0 || >=3.10.1')));
	assert.ok(!(new Version('3.10.0').satisfies('>=2.15.8 <3.0.0 || >=3.10.1')));

	assert.throws(
		() => new Version('1.2.3').satisfies('=>1.0.0'),
		{message: 'Range =>1.0.0 is not a valid SemVer range.'},
	);
});

test('isPrerelease', () => {
	assert.ok(!(new Version('1.0.0').isPrerelease()));
	assert.ok(!(new Version('1.1.0').isPrerelease()));
	assert.ok(!(new Version('1.0.1').isPrerelease()));

	assert.ok(new Version('1.0.0-alpha.1').isPrerelease());
	assert.ok(new Version('1.0.0-beta').isPrerelease());
	assert.ok(new Version('2.0.0-rc.2').isPrerelease());
});

test('optionally set prereleasePrefix', () => {
	assert.equal(new Version('1.0.0', 'prerelease', {prereleasePrefix: 'alpha'}).toString(), '1.0.1-alpha.0');
	assert.equal(new Version('1.0.0').setFrom('prerelease', {prereleasePrefix: 'beta'}).toString(), '1.0.1-beta.0');
});

test('setFrom with explicit version and format - for UI display', () => {
	// This pattern is used in ui.js to display version info when user provides explicit version
	const currentVersion = '1.0.0';
	const explicitVersion = '2.5.0';
	const formattedVersion = new Version(currentVersion).setFrom(explicitVersion).format();

	assert.equal(formattedVersion, makeNewFormattedVersion('{2}.5.0'));
});
