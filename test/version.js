import test from 'ava';
import {template as chalk} from 'chalk-template';
import Version from '../source/version.js';

const INCREMENT_LIST = '`major`, `minor`, `patch`, `premajor`, `preminor`, `prepatch`, `prerelease`';

/** @param {string} input - Place `{ }` around the version parts to be highlighted. */
const makeNewFormattedVersion = input => {
	input = input.replaceAll(/{([^}]*)}/g, '{cyan $1}'); // https://regex101.com/r/rZUIp4/1
	return chalk(`{dim ${input}}`);
};

test('new Version - valid', t => {
	t.is(new Version('1.0.0').version, '1.0.0');
});

test('new Version - invalid', t => {
	t.throws(
		() => new Version('major'),
		{message: 'Version `major` should be a valid `SemVer` version.'},
	);
});

test('new Version - valid w/ valid increment', t => {
	t.is(new Version('1.0.0', 'major').version, '2.0.0');
});

test('new Version - invalid w/ valid increment', t => {
	t.throws(
		() => new Version('major', 'major'),
		{message: 'Version `major` should be a valid `SemVer` version.'},
	);
});

test('new Version - valid w/ invalid increment', t => {
	t.throws(
		() => new Version('1.0.0', '2.0.0'), // TODO: join last as 'or'?
		{message: `Increment \`2.0.0\` should be one of ${INCREMENT_LIST}.`},
	);
});

test('new Version - invalid w/ invalid increment', t => {
	t.throws(
		() => new Version('major', '2.0.0'),
		{message: 'Version `major` should be a valid `SemVer` version.'},
	);
});

// Input as SemVer increment is covered in constructor tests
test('setNewVersionFrom - valid input as version', t => {
	t.is(new Version('1.0.0').setNewVersionFrom('2.0.0').version, '2.0.0');
});

test('setNewVersionFrom - invalid input as version', t => {
	t.throws(
		() => new Version('1.0.0').setNewVersionFrom('200'),
		{message: `New version \`200\` should either be one of ${INCREMENT_LIST}, or a valid \`SemVer\` version.`},
	);
});

test('setNewVersionFrom - valid input is not higher than version', t => {
	t.throws(
		() => new Version('1.0.0').setNewVersionFrom('0.2.0'),
		{message: 'New version `0.2.0` should be higher than current version `1.0.0`.'},
	);
});

test('format', t => {
	t.is(new Version('0.0.0').format(), makeNewFormattedVersion('0.0.0'));
});

test('format - major', t => {
	const newVersion = makeNewFormattedVersion('{1}.0.0');

	t.is(new Version('0.0.0').setNewVersionFrom('major').format(), newVersion);
	t.is(new Version('0.0.0').setNewVersionFrom('1.0.0').format(), newVersion);
});

test('format - minor', t => {
	const newVersion = makeNewFormattedVersion('0.{1}.0');

	t.is(new Version('0.0.0').setNewVersionFrom('minor').format(), newVersion);
	t.is(new Version('0.0.0').setNewVersionFrom('0.1.0').format(), newVersion);
});

test('format - patch', t => {
	const newVersion = makeNewFormattedVersion('0.0.{1}');

	t.is(new Version('0.0.0').setNewVersionFrom('patch').format(), newVersion);
	t.is(new Version('0.0.0').setNewVersionFrom('0.0.1').format(), newVersion);
});

test('format - premajor', t => {
	const newVersion = makeNewFormattedVersion('{1}.0.0-{0}');

	t.is(new Version('0.0.0').setNewVersionFrom('premajor').format(), newVersion);
	t.is(new Version('0.0.0').setNewVersionFrom('1.0.0-0').format(), newVersion);
});

test('format - preminor', t => {
	const newVersion = makeNewFormattedVersion('0.{1}.0-{0}');

	t.is(new Version('0.0.0').setNewVersionFrom('preminor').format(), newVersion);
	t.is(new Version('0.0.0').setNewVersionFrom('0.1.0-0').format(), newVersion);
});

test('format - prepatch', t => {
	const newVersion = makeNewFormattedVersion('0.0.{1}-{0}');

	t.is(new Version('0.0.0').setNewVersionFrom('prepatch').format(), newVersion);
	t.is(new Version('0.0.0').setNewVersionFrom('0.0.1-0').format(), newVersion);
});

test('format - prerelease', t => {
	const newVersion = makeNewFormattedVersion('0.0.0-{1}');

	t.is(new Version('0.0.0-0').setNewVersionFrom('prerelease').format(), newVersion);
	t.is(new Version('0.0.0-0').setNewVersionFrom('0.0.0-1').format(), newVersion);
});

test.failing('format - prerelease as prepatch', t => {
	const newVersion = makeNewFormattedVersion('0.0.{1}-{0}');

	t.is(new Version('0.0.0').setNewVersionFrom('prerelease').format(), newVersion);
	t.is(new Version('0.0.0').setNewVersionFrom('0.0.1-0').format(), newVersion);
});

test('format - prerelease with multiple numbers', t => {
	const newVersion = makeNewFormattedVersion('0.0.{1}-{0.0}'); // TODO: should it be {0}.{0}?
	t.is(new Version('0.0.0').setNewVersionFrom('0.0.1-0.0').format(), newVersion);
});

test('format - prerelease with text', t => {
	const newVersion = makeNewFormattedVersion('0.0.{1}-{alpha.0}'); // TODO: should it be {alpha}.{0}?
	t.is(new Version('0.0.0').setNewVersionFrom('0.0.1-alpha.0').format(), newVersion);
});

test('satisfies', t => {
	t.true(new Version('2.15.8').satisfies('>=2.15.8 <3.0.0 || >=3.10.1'));
	t.true(new Version('2.99.8').satisfies('>=2.15.8 <3.0.0 || >=3.10.1'));
	t.true(new Version('3.10.1').satisfies('>=2.15.8 <3.0.0 || >=3.10.1'));
	t.true(new Version('6.7.0-next.0').satisfies('<6.8.0'));
	t.false(new Version('3.0.0').satisfies('>=2.15.8 <3.0.0 || >=3.10.1'));
	t.false(new Version('3.10.0').satisfies('>=2.15.8 <3.0.0 || >=3.10.1'));
});

test('isPrerelease', t => {
	t.false(new Version('1.0.0').isPrerelease());
	t.false(new Version('1.1.0').isPrerelease());
	t.false(new Version('1.0.1').isPrerelease());

	t.true(new Version('1.0.0-alpha.1').isPrerelease());
	t.true(new Version('1.0.0-beta').isPrerelease());
	t.true(new Version('2.0.0-rc.2').isPrerelease());
});
