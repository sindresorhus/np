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
	t.false(version('patch').isPrereleaseVersion());
	t.false(version('minor').isPrereleaseVersion());
	t.false(version('major').isPrereleaseVersion());

	t.false(version('1.0.0').isPrereleaseVersion());
	t.false(version('1.1.0').isPrereleaseVersion());
	t.false(version('1.0.1').isPrereleaseVersion());

	t.true(version('prepatch').isPrereleaseVersion());
	t.true(version('preminor').isPrereleaseVersion());
	t.true(version('premajor').isPrereleaseVersion());
	t.true(version('prerelease').isPrereleaseVersion());
	t.true(version('1.0.0-beta').isPrereleaseVersion());
	t.true(version('2.0.0-rc.2').isPrereleaseVersion());
});

test('version.getNewVersion', t => {
	const message = 'Version should be either patch, minor, major, prepatch, preminor, premajor, prerelease or a valid semver version.';

	t.throws(() => version('1.0.0').getNewVersion('patchxxx'), message);
	t.throws(() => version('1.0.0').getNewVersion('1.0.0.0'), message);

	t.is(version('1.0.0').getNewVersion('patch'), '1.0.1');
	t.is(version('1.0.0').getNewVersion('minor'), '1.1.0');
	t.is(version('1.0.0').getNewVersion('major'), '2.0.0');

	t.is(version('1.0.0-beta').getNewVersion('major'), '1.0.0');
	t.is(version('1.0.0').getNewVersion('prepatch'), '1.0.1-0');
	t.is(version('1.0.1-0').getNewVersion('prepatch'), '1.0.2-0');

	t.is(version('1.0.0-0').getNewVersion('prerelease'), '1.0.0-1');
	t.is(version('1.0.1-0').getNewVersion('prerelease'), '1.0.1-1');
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

test('version.isGreaterThanOrEqualTo', t => {
	t.false(version('1.0.0').isGreaterThanOrEqualTo('0.0.1'));
	t.false(version('1.0.0').isGreaterThanOrEqualTo('0.1.0'));

	t.false(version('1.0.0').isGreaterThanOrEqualTo('1.0.0-0'));
	t.false(version('1.0.0').isGreaterThanOrEqualTo('1.0.0-beta'));

	t.true(version('1.0.0').isGreaterThanOrEqualTo('1.0.0'));
	t.true(version('1.0.0').isGreaterThanOrEqualTo('1.0.1'));
	t.true(version('1.0.0').isGreaterThanOrEqualTo('1.1.0'));
	t.true(version('1.0.0').isGreaterThanOrEqualTo('2.0.0'));

	t.true(version('1.0.0').isGreaterThanOrEqualTo('2.0.0-0'));
	t.true(version('1.0.0').isGreaterThanOrEqualTo('2.0.0-beta'));
});

test('version.isLowerThanOrEqualTo', t => {
	t.true(version('1.0.0').isLowerThanOrEqualTo('0.0.1'));
	t.true(version('1.0.0').isLowerThanOrEqualTo('0.1.0'));

	t.true(version('1.0.0').isLowerThanOrEqualTo('1.0.0-0'));
	t.true(version('1.0.0').isLowerThanOrEqualTo('1.0.0-beta'));
	t.true(version('1.0.0').isLowerThanOrEqualTo('1.0.0'));

	t.false(version('1.0.0').isLowerThanOrEqualTo('1.0.1'));
	t.false(version('1.0.0').isLowerThanOrEqualTo('1.1.0'));
	t.false(version('1.0.0').isLowerThanOrEqualTo('2.0.0'));

	t.false(version('1.0.0').isLowerThanOrEqualTo('2.0.0-0'));
	t.false(version('1.0.0').isLowerThanOrEqualTo('2.0.0-beta'));
});

test('version.satisfies', t => {
	t.true(version.satisfies('2.15.8', '>=2.15.8 <3.0.0 || >=3.10.1'));
	t.true(version.satisfies('2.99.8', '>=2.15.8 <3.0.0 || >=3.10.1'));
	t.true(version.satisfies('3.10.1', '>=2.15.8 <3.0.0 || >=3.10.1'));
	t.true(version.satisfies('6.7.0-next.0', '<6.8.0'));
	t.false(version.satisfies('3.0.0', '>=2.15.8 <3.0.0 || >=3.10.1'));
	t.false(version.satisfies('3.10.0', '>=2.15.8 <3.0.0 || >=3.10.1'));
});
