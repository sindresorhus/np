import test from 'ava';
import version from '../source/version';

test('version.SEMVER_INCREMENTS', t => {
	t.deepEqual(version.SEMVER_INCREMENTS, ['patch', 'minor', 'major', 'prepatch', 'preminor', 'premajor', 'prerelease']);
});

test('version.PRERELEASE_VERSIONS', t => {
	t.deepEqual(version.PRERELEASE_VERSIONS, ['prepatch', 'preminor', 'premajor', 'prerelease']);
});

test('version.isValidVersionInput', t => {
	t.false(version.isValidVersionInput(null));
	t.false(version.isValidVersionInput('foo'));
	t.false(version.isValidVersionInput('1.0.0.0'));

	t.true(version.isValidVersionInput('patch'));
	t.true(version.isValidVersionInput('minor'));
	t.true(version.isValidVersionInput('major'));
	t.true(version.isValidVersionInput('prepatch'));
	t.true(version.isValidVersionInput('preminor'));
	t.true(version.isValidVersionInput('premajor'));
	t.true(version.isValidVersionInput('prerelease'));
	t.true(version.isValidVersionInput('1.0.0'));
	t.true(version.isValidVersionInput('1.1.0'));
	t.true(version.isValidVersionInput('1.0.1'));
	t.true(version.isValidVersionInput('1.0.0-beta'));
	t.true(version.isValidVersionInput('2.0.0-rc.2'));
});

test('version.isPrereleaseVersion', t => {
	t.false(version.isPrereleaseVersion('patch'));
	t.false(version.isPrereleaseVersion('minor'));
	t.false(version.isPrereleaseVersion('major'));
	t.false(version.isPrereleaseVersion('1.0.0'));
	t.false(version.isPrereleaseVersion('1.1.0'));
	t.false(version.isPrereleaseVersion('1.0.1'));

	t.true(version.isPrereleaseVersion('prepatch'));
	t.true(version.isPrereleaseVersion('preminor'));
	t.true(version.isPrereleaseVersion('premajor'));
	t.true(version.isPrereleaseVersion('prerelease'));
	t.true(version.isPrereleaseVersion('1.0.0-beta'));
	t.true(version.isPrereleaseVersion('2.0.0-rc.2'));
});

test('version.getNewVersion', t => {
	const message = 'Version should be either patch, minor, major, prepatch, preminor, premajor, prerelease or a valid semver version.';

	t.throws(() => version.getNewVersion('1.0.0', 'patchxxx'), message);
	t.throws(() => version.getNewVersion('1.0.0', '1.0.0.0'), message);

	t.is(version.getNewVersion('1.0.0', 'patch'), '1.0.1');
	t.is(version.getNewVersion('1.0.0', 'minor'), '1.1.0');
	t.is(version.getNewVersion('1.0.0', 'major'), '2.0.0');

	t.is(version.getNewVersion('1.0.0-beta', 'major'), '1.0.0');
	t.is(version.getNewVersion('1.0.0', 'prepatch'), '1.0.1-0');
	t.is(version.getNewVersion('1.0.1-0', 'prepatch'), '1.0.2-0');

	t.is(version.getNewVersion('1.0.0-0', 'prerelease'), '1.0.0-1');
	t.is(version.getNewVersion('1.0.1-0', 'prerelease'), '1.0.1-1');
});

test('version.validateVersion', t => {
	const message = 'Version should be a valid semver version.';

	t.throws(() => version.validateVersion('patch'), message);
	t.throws(() => version.validateVersion('patchxxx'), message);
	t.throws(() => version.validateVersion('1.0.0.0'), message);

	t.notThrows(() => version.validateVersion('1.0.0'));
	t.notThrows(() => version.validateVersion('1.0.0-beta'));
	t.notThrows(() => version.validateVersion('1.0.0-0'));
});

test('version.isVersionGreaterThan', t => {
	t.false(version.isVersionGreaterThan('1.0.0', '0.0.1'));
	t.false(version.isVersionGreaterThan('1.0.0', '0.1.0'));
	t.false(version.isVersionGreaterThan('1.0.0', '1.0.0'));

	t.false(version.isVersionGreaterThan('1.0.0', '1.0.0-0'));
	t.false(version.isVersionGreaterThan('1.0.0', '1.0.0-beta'));

	t.true(version.isVersionGreaterThan('1.0.0', '1.0.1'));
	t.true(version.isVersionGreaterThan('1.0.0', '1.1.0'));
	t.true(version.isVersionGreaterThan('1.0.0', '2.0.0'));

	t.true(version.isVersionGreaterThan('1.0.0', '2.0.0-0'));
	t.true(version.isVersionGreaterThan('1.0.0', '2.0.0-beta'));
});

test('version.isVersionEqualTo', t => {
	t.true(version.isVersionEqualTo('1.0.0', '1.0.0'));
	t.true(version.isVersionEqualTo('1.0.0-beta', '1.0.0-beta'));
	t.true(version.isVersionEqualTo('1.0.0-0', '1.0.0-0'));
});

test('version.satisfies', t => {
	t.true(version.satisfies('2.15.8', '>=2.15.8 <3.0.0 || >=3.10.1'));
	t.true(version.satisfies('2.99.8', '>=2.15.8 <3.0.0 || >=3.10.1'));
	t.true(version.satisfies('3.10.1', '>=2.15.8 <3.0.0 || >=3.10.1'));
	t.true(version.satisfies('6.7.0-next.0', '<6.8.0'));
	t.false(version.satisfies('3.0.0', '>=2.15.8 <3.0.0 || >=3.10.1'));
	t.false(version.satisfies('3.10.0', '>=2.15.8 <3.0.0 || >=3.10.1'));
});
