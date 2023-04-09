import test from 'ava';
import {template as chalk} from 'chalk-template';
import prettyVersionDiff from '../source/pretty-version-diff.js';

/** @param {string} input - Place `{ }` around the version parts to be highlighted. */
const makeNewVersion = input => {
	input = input.replaceAll(/{([^}]*)}/g, '{cyan $1}'); // https://regex101.com/r/rZUIp4/1
	return chalk(`{dim ${input}}`);
};

test('major', t => {
	const newVersion = makeNewVersion('{1}.0.0');

	t.is(prettyVersionDiff('0.0.0', 'major'), newVersion);
	t.is(prettyVersionDiff('0.0.0', '1.0.0'), newVersion);
});

test('minor', t => {
	const newVersion = makeNewVersion('0.{1}.0');

	t.is(prettyVersionDiff('0.0.0', 'minor'), newVersion);
	t.is(prettyVersionDiff('0.0.0', '0.1.0'), newVersion);
});

test('patch', t => {
	const newVersion = makeNewVersion('0.0.{1}');

	t.is(prettyVersionDiff('0.0.0', 'patch'), newVersion);
	t.is(prettyVersionDiff('0.0.0', '0.0.1'), newVersion);
});

test('premajor', t => {
	const newVersion = makeNewVersion('{1}.0.0-{0}');

	t.is(prettyVersionDiff('0.0.0', 'premajor'), newVersion);
	t.is(prettyVersionDiff('0.0.0', '1.0.0-0'), newVersion);
});

test('preminor', t => {
	const newVersion = makeNewVersion('0.{1}.0-{0}');

	t.is(prettyVersionDiff('0.0.0', 'preminor'), newVersion);
	t.is(prettyVersionDiff('0.0.0', '0.1.0-0'), newVersion);
});

test('prepatch', t => {
	const newVersion = makeNewVersion('0.0.{1}-{0}');

	t.is(prettyVersionDiff('0.0.0', 'prepatch'), newVersion);
	t.is(prettyVersionDiff('0.0.0', '0.0.1-0'), newVersion);
});

test('prerelease', t => {
	const newVersion = makeNewVersion('0.0.0-{1}');

	t.is(prettyVersionDiff('0.0.0-0', 'prerelease'), newVersion);
	t.is(prettyVersionDiff('0.0.0-0', '0.0.0-1'), newVersion);
});

test('prerelease as prepatch', t => {
	const newVersion = makeNewVersion('0.0.{1}-{0}');

	t.is(prettyVersionDiff('0.0.0', 'prerelease'), newVersion);
	t.is(prettyVersionDiff('0.0.0', '0.0.1-0'), newVersion);
});

test('prerelease with multiple numbers', t => {
	const newVersion = makeNewVersion('0.0.{1}-{0.0}'); // TODO: should it be {0}.{0}?
	t.is(prettyVersionDiff('0.0.0', '0.0.1-0.0'), newVersion);
});

test('prerelease with text', t => {
	const newVersion = makeNewVersion('0.0.{1}-{alpha.0}'); // TODO: should it be {alpha}.{0}?
	t.is(prettyVersionDiff('0.0.0', '0.0.1-alpha.0'), newVersion);
});
