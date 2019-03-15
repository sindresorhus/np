import test from 'ava';
import version from '../source/version';

test('version.SEMVER_INCREMENTS', t => {
	t.deepEqual(version.SEMVER_INCREMENTS, ['patch', 'minor', 'major', 'prepatch', 'preminor', 'premajor', 'prerelease']);
});

test('version.PRERELEASE_VERSIONS', t => {
	t.deepEqual(version.PRERELEASE_VERSIONS, ['prepatch', 'preminor', 'premajor', 'prerelease']);
});

test('version.isValidInput', t => {
	t.false(version.isValidInput(null));
	t.false(version.isValidInput('foo'));
	t.false(version.isValidInput('1.0.0.0'));

	t.true(version.isValidInput('patch'));
	t.true(version.isValidInput('minor'));
	t.true(version.isValidInput('major'));
	t.true(version.isValidInput('prepatch'));
	t.true(version.isValidInput('preminor'));
	t.true(version.isValidInput('premajor'));
	t.true(version.isValidInput('prerelease'));
	t.true(version.isValidInput('1.0.0'));
	t.true(version.isValidInput('1.1.0'));
	t.true(version.isValidInput('1.0.1'));
	t.true(version.isValidInput('1.0.0-beta'));
	t.true(version.isValidInput('2.0.0-rc.2'));
});

test('version.isPrerelease', t => {
	t.false(version('1.0.0').isPrerelease());
	t.false(version('1.1.0').isPrerelease());
	t.false(version('1.0.1').isPrerelease());

	t.true(version('1.0.0-beta').isPrerelease());
	t.true(version('2.0.0-rc.2').isPrerelease());
});

test('version.isPrereleaseOrIncrement', t => {
	t.false(version.isPrereleaseOrIncrement('patch'));
	t.false(version.isPrereleaseOrIncrement('minor'));
	t.false(version.isPrereleaseOrIncrement('major'));

	t.true(version.isPrereleaseOrIncrement('prepatch'));
	t.true(version.isPrereleaseOrIncrement('preminor'));
	t.true(version.isPrereleaseOrIncrement('premajor'));
	t.true(version.isPrereleaseOrIncrement('prerelease'));
});

test('version.getNewVersionFrom', t => {
	const message = 'Version should be either patch, minor, major, prepatch, preminor, premajor, prerelease or a valid semver version.';

	t.throws(() => version('1.0.0').getNewVersionFrom('patchxxx'), message);
	t.throws(() => version('1.0.0').getNewVersionFrom('1.0.0.0'), message);

	t.is(version('1.0.0').getNewVersionFrom('patch'), '1.0.1');
	t.is(version('1.0.0').getNewVersionFrom('minor'), '1.1.0');
	t.is(version('1.0.0').getNewVersionFrom('major'), '2.0.0');

	t.is(version('1.0.0-beta').getNewVersionFrom('major'), '1.0.0');
	t.is(version('1.0.0').getNewVersionFrom('prepatch'), '1.0.1-0');
	t.is(version('1.0.1-0').getNewVersionFrom('prepatch'), '1.0.2-0');

	t.is(version('1.0.0-0').getNewVersionFrom('prerelease'), '1.0.0-1');
	t.is(version('1.0.1-0').getNewVersionFrom('prerelease'), '1.0.1-1');
});

test('version.validate', t => {
	const message = 'Version should be a valid semver version.';

	t.throws(() => version.validate('patch'), message);
	t.throws(() => version.validate('patchxxx'), message);
	t.throws(() => version.validate('1.0.0.0'), message);

	t.notThrows(() => version.validate('1.0.0'));
	t.notThrows(() => version.validate('1.0.0-beta'));
	t.notThrows(() => version.validate('1.0.0-0'));
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
	t.true(version('2.15.8').satisfies('>=2.15.8 <3.0.0 || >=3.10.1'));
	t.true(version('2.99.8').satisfies('>=2.15.8 <3.0.0 || >=3.10.1'));
	t.true(version('3.10.1').satisfies('>=2.15.8 <3.0.0 || >=3.10.1'));
	t.true(version('6.7.0-next.0').satisfies('<6.8.0'));
	t.false(version('3.0.0').satisfies('>=2.15.8 <3.0.0 || >=3.10.1'));
	t.false(version('3.10.0').satisfies('>=2.15.8 <3.0.0 || >=3.10.1'));
});
