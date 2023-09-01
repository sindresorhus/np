import test from 'ava';
import sinon from 'sinon';
import {template as chalk} from 'chalk-template';
import semver from 'semver';
import Version from '../source/version.js';

const INCREMENT_LIST = 'patch, minor, major, prepatch, preminor, premajor, prerelease';
const INCREMENT_LIST_OR = 'patch, minor, major, prepatch, preminor, premajor, or prerelease';

/** @param {string} input - Place `{ }` around the version parts to be highlighted. */
const makeNewFormattedVersion = input => {
	input = input.replaceAll(/{([^}]*)}/g, '{cyan $1}'); // https://regex101.com/r/rZUIp4/1
	return chalk(`{dim ${input}}`);
};

test('new Version - valid', t => {
	t.is(new Version('1.0.0').toString(), '1.0.0');
});

test('new Version - invalid', t => {
	t.throws(
		() => new Version('major'),
		{message: 'Version major should be a valid SemVer version.'},
	);
});

test('new Version - valid w/ valid increment', t => {
	t.is(new Version('1.0.0', 'major').toString(), '2.0.0');
});

test('new Version - invalid w/ valid increment', t => {
	t.throws(
		() => new Version('major', 'major'),
		{message: 'Version major should be a valid SemVer version.'},
	);
});

test('new Version - valid w/ invalid increment', t => {
	t.throws(
		() => new Version('1.0.0', '2.0.0'),
		{message: `Increment 2.0.0 should be one of ${INCREMENT_LIST_OR}.`},
	);
});

test('new Version - invalid w/ invalid increment', t => {
	t.throws(
		() => new Version('major', '2.0.0'),
		{message: 'Version major should be a valid SemVer version.'},
	);
});

// Input as SemVer increment is covered in constructor tests
test('setFrom - valid input as version', t => {
	t.is(new Version('1.0.0').setFrom('2.0.0').toString(), '2.0.0');
});

test('setFrom - invalid input as version', t => {
	t.throws(
		() => new Version('1.0.0').setFrom('200'),
		{message: `New version 200 should either be one of ${INCREMENT_LIST}, or a valid SemVer version.`},
	);
});

test('setFrom - valid input is not higher than version', t => {
	t.throws(
		() => new Version('1.0.0').setFrom('0.2.0'),
		{message: 'New version 0.2.0 should be higher than current version 1.0.0.'},
	);
});

test('format', t => {
	t.is(new Version('0.0.0').format(), makeNewFormattedVersion('0.0.0'));
});

test('format - set diff', t => {
	t.is(
		new Version('1.0.0').format({previousVersion: '0.0.0'}),
		makeNewFormattedVersion('{1}.0.0'),
	);
});

test('format - major', t => {
	const newVersion = makeNewFormattedVersion('{1}.0.0');

	t.is(new Version('0.0.0').setFrom('major').format(), newVersion);
	t.is(new Version('0.0.0').setFrom('1.0.0').format(), newVersion);
});

test('format - minor', t => {
	const newVersion = makeNewFormattedVersion('0.{1}.0');

	t.is(new Version('0.0.0').setFrom('minor').format(), newVersion);
	t.is(new Version('0.0.0').setFrom('0.1.0').format(), newVersion);
});

test('format - patch', t => {
	const newVersion = makeNewFormattedVersion('0.0.{1}');

	t.is(new Version('0.0.0').setFrom('patch').format(), newVersion);
	t.is(new Version('0.0.0').setFrom('0.0.1').format(), newVersion);
});

test('format - premajor', t => {
	const newVersion = makeNewFormattedVersion('{1}.0.0-{0}');

	t.is(new Version('0.0.0').setFrom('premajor').format(), newVersion);
	t.is(new Version('0.0.0').setFrom('1.0.0-0').format(), newVersion);
});

test('format - preminor', t => {
	const newVersion = makeNewFormattedVersion('0.{1}.0-{0}');

	t.is(new Version('0.0.0').setFrom('preminor').format(), newVersion);
	t.is(new Version('0.0.0').setFrom('0.1.0-0').format(), newVersion);
});

test('format - prepatch', t => {
	const newVersion = makeNewFormattedVersion('0.0.{1}-{0}');

	t.is(new Version('0.0.0').setFrom('prepatch').format(), newVersion);
	t.is(new Version('0.0.0').setFrom('0.0.1-0').format(), newVersion);
});

test('format - prerelease', t => {
	const newVersion = makeNewFormattedVersion('0.0.0-{1}');

	t.is(new Version('0.0.0-0').setFrom('prerelease').format(), newVersion);
	t.is(new Version('0.0.0-0').setFrom('0.0.0-1').format(), newVersion);
});

test('format - prerelease as prepatch', t => {
	const newVersion = makeNewFormattedVersion('0.0.{1}-{0}');

	t.is(new Version('0.0.0').setFrom('prerelease').format(), newVersion);
	t.is(new Version('0.0.0').setFrom('0.0.1-0').format(), newVersion);
});

test('format - prerelease with multiple numbers', t => {
	const newVersion = makeNewFormattedVersion('0.0.{1}-{0.0}');
	t.is(new Version('0.0.0').setFrom('0.0.1-0.0').format(), newVersion);
});

test('format - prerelease with text', t => {
	const newVersion = makeNewFormattedVersion('0.0.{1}-{alpha.0}');
	t.is(new Version('0.0.0').setFrom('0.0.1-alpha.0').format(), newVersion);
});

test('format - prerelease diffs', t => {
	const newVersion = makeNewFormattedVersion('0.0.0-1.{2}');

	t.is(
		new Version('0.0.0-1.1').setFrom('0.0.0-1.2').format({previousVersion: '0.0.0-1.1'}),
		newVersion,
	);

	t.is(
		new Version('0.0.0-1.2').format({previousVersion: '0.0.0-1.1'}),
		newVersion,
	);
});

test('format - custom colors', t => {
	t.is(
		new Version('1.2.3').format({color: 'green'}),
		chalk('{green 1.2.3}'),
	);

	t.is(
		new Version('1.2.3', 'minor').format({diffColor: 'red'}),
		chalk('{dim 1.{red 3}.0}'),
	);

	t.is(
		new Version('1.2.3', 'patch').format({color: 'bgBlack.red', diffColor: 'yellow'}),
		chalk('{bgBlack.red 1.2.{yellow 4}}'),
	);

	t.is(
		new Version('1.2.3', 'prerelease').format({color: 'bgBlack.red', diffColor: 'yellow'}),
		chalk('{bgBlack.red 1.2.{yellow 4}-{yellow 0}}'),
	);
});

test('format - previousVersion as SemVer instance', t => {
	const previousVersion = semver.parse('0.0.0');
	const newVersion = makeNewFormattedVersion('{1}.0.0');

	const spy = sinon.spy(semver, 'parse');

	t.is(new Version('1.0.0').format({previousVersion}), newVersion);
	t.true(spy.calledOnce, 'semver.parse was called for previousVersion!');

	spy.resetHistory();

	t.is(new Version('1.0.0').format({previousVersion: '0.0.0'}), newVersion);
	t.true(spy.calledTwice, 'semver.parse was not called for previousVersion!');
});

test('format - invalid previousVersion', t => {
	t.throws(
		() => new Version('1.0.0').format({previousVersion: '000'}),
		{message: 'Previous version 000 should be a valid SemVer version.'},
	);
});

test('satisfies', t => {
	t.true(new Version('2.15.8').satisfies('>=2.15.8 <3.0.0 || >=3.10.1'));
	t.true(new Version('2.99.8').satisfies('>=2.15.8 <3.0.0 || >=3.10.1'));
	t.true(new Version('3.10.1').satisfies('>=2.15.8 <3.0.0 || >=3.10.1'));
	t.true(new Version('6.7.0-next.0').satisfies('<6.8.0'));

	t.false(new Version('3.0.0').satisfies('>=2.15.8 <3.0.0 || >=3.10.1'));
	t.false(new Version('3.10.0').satisfies('>=2.15.8 <3.0.0 || >=3.10.1'));

	t.throws(
		() => new Version('1.2.3').satisfies('=>1.0.0'),
		{message: 'Range =>1.0.0 is not a valid SemVer range.'},
	);
});

test('isPrerelease', t => {
	t.false(new Version('1.0.0').isPrerelease());
	t.false(new Version('1.1.0').isPrerelease());
	t.false(new Version('1.0.1').isPrerelease());

	t.true(new Version('1.0.0-alpha.1').isPrerelease());
	t.true(new Version('1.0.0-beta').isPrerelease());
	t.true(new Version('2.0.0-rc.2').isPrerelease());
});

test('optionally set prereleasePrefix', t => {
	t.is(new Version('1.0.0', 'prerelease', {prereleasePrefix: 'alpha'}).toString(), '1.0.1-alpha.0');
	t.is(new Version('1.0.0').setFrom('prerelease', {prereleasePrefix: 'beta'}).toString(), '1.0.1-beta.0');
});
