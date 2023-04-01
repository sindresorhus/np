import test from 'ava';
import Version from '../source/version.js';

test('version.SEMVER_INCREMENTS', t => {
	t.deepEqual(Version.SEMVER_INCREMENTS, ['patch', 'minor', 'major', 'prepatch', 'preminor', 'premajor', 'prerelease']);
});

test('version.PRERELEASE_VERSIONS', t => {
	t.deepEqual(Version.PRERELEASE_VERSIONS, ['prepatch', 'preminor', 'premajor', 'prerelease']);
});

test('version.isValidInput', t => {
	t.false(Version.isValidInput(null));
	t.false(Version.isValidInput('foo'));
	t.false(Version.isValidInput('1.0.0.0'));

	t.true(Version.isValidInput('patch'));
	t.true(Version.isValidInput('minor'));
	t.true(Version.isValidInput('major'));
	t.true(Version.isValidInput('prepatch'));
	t.true(Version.isValidInput('preminor'));
	t.true(Version.isValidInput('premajor'));
	t.true(Version.isValidInput('prerelease'));
	t.true(Version.isValidInput('1.0.0'));
	t.true(Version.isValidInput('1.1.0'));
	t.true(Version.isValidInput('1.0.1'));
	t.true(Version.isValidInput('1.0.0-beta'));
	t.true(Version.isValidInput('2.0.0-rc.2'));
});

test('version.isPrerelease', t => {
	t.false(new Version('1.0.0').isPrerelease());
	t.false(new Version('1.1.0').isPrerelease());
	t.false(new Version('1.0.1').isPrerelease());

	t.true(new Version('1.0.0-beta').isPrerelease());
	t.true(new Version('2.0.0-rc.2').isPrerelease());
});

test('version.isPrereleaseOrIncrement', t => {
	t.false(Version.isPrereleaseOrIncrement('patch'));
	t.false(Version.isPrereleaseOrIncrement('minor'));
	t.false(Version.isPrereleaseOrIncrement('major'));

	t.true(Version.isPrereleaseOrIncrement('prepatch'));
	t.true(Version.isPrereleaseOrIncrement('preminor'));
	t.true(Version.isPrereleaseOrIncrement('premajor'));
	t.true(Version.isPrereleaseOrIncrement('prerelease'));
});

test('version.getNewVersionFrom', t => {
	const message = 'Version should be either patch, minor, major, prepatch, preminor, premajor, prerelease, or a valid semver version.';

	t.throws(() => new Version('1.0.0').getNewVersionFrom('patchxxx'), {message});
	t.throws(() => new Version('1.0.0').getNewVersionFrom('1.0.0.0'), {message});

	t.is(new Version('1.0.0').getNewVersionFrom('patch'), '1.0.1');
	t.is(new Version('1.0.0').getNewVersionFrom('minor'), '1.1.0');
	t.is(new Version('1.0.0').getNewVersionFrom('major'), '2.0.0');

	t.is(new Version('1.0.0-beta').getNewVersionFrom('major'), '1.0.0');
	t.is(new Version('1.0.0').getNewVersionFrom('prepatch'), '1.0.1-0');
	t.is(new Version('1.0.1-0').getNewVersionFrom('prepatch'), '1.0.2-0');

	t.is(new Version('1.0.0-0').getNewVersionFrom('prerelease'), '1.0.0-1');
	t.is(new Version('1.0.1-0').getNewVersionFrom('prerelease'), '1.0.1-1');
});

test('version.validate', t => {
	const message = 'Version should be a valid semver version.';

	t.throws(() => Version.validate('patch'), {message});
	t.throws(() => Version.validate('patchxxx'), {message});
	t.throws(() => Version.validate('1.0.0.0'), {message});

	t.notThrows(() => Version.validate('1.0.0'));
	t.notThrows(() => Version.validate('1.0.0-beta'));
	t.notThrows(() => Version.validate('1.0.0-0'));
});

test('version.isGreaterThanOrEqualTo', t => {
	t.false(new Version('1.0.0').isGreaterThanOrEqualTo('0.0.1'));
	t.false(new Version('1.0.0').isGreaterThanOrEqualTo('0.1.0'));

	t.false(new Version('1.0.0').isGreaterThanOrEqualTo('1.0.0-0'));
	t.false(new Version('1.0.0').isGreaterThanOrEqualTo('1.0.0-beta'));

	t.true(new Version('1.0.0').isGreaterThanOrEqualTo('1.0.0'));
	t.true(new Version('1.0.0').isGreaterThanOrEqualTo('1.0.1'));
	t.true(new Version('1.0.0').isGreaterThanOrEqualTo('1.1.0'));
	t.true(new Version('1.0.0').isGreaterThanOrEqualTo('2.0.0'));

	t.true(new Version('1.0.0').isGreaterThanOrEqualTo('2.0.0-0'));
	t.true(new Version('1.0.0').isGreaterThanOrEqualTo('2.0.0-beta'));
});

test('version.isLowerThanOrEqualTo', t => {
	t.true(new Version('1.0.0').isLowerThanOrEqualTo('0.0.1'));
	t.true(new Version('1.0.0').isLowerThanOrEqualTo('0.1.0'));

	t.true(new Version('1.0.0').isLowerThanOrEqualTo('1.0.0-0'));
	t.true(new Version('1.0.0').isLowerThanOrEqualTo('1.0.0-beta'));
	t.true(new Version('1.0.0').isLowerThanOrEqualTo('1.0.0'));

	t.false(new Version('1.0.0').isLowerThanOrEqualTo('1.0.1'));
	t.false(new Version('1.0.0').isLowerThanOrEqualTo('1.1.0'));
	t.false(new Version('1.0.0').isLowerThanOrEqualTo('2.0.0'));

	t.false(new Version('1.0.0').isLowerThanOrEqualTo('2.0.0-0'));
	t.false(new Version('1.0.0').isLowerThanOrEqualTo('2.0.0-beta'));
});

test('version.satisfies', t => {
	t.true(new Version('2.15.8').satisfies('>=2.15.8 <3.0.0 || >=3.10.1'));
	t.true(new Version('2.99.8').satisfies('>=2.15.8 <3.0.0 || >=3.10.1'));
	t.true(new Version('3.10.1').satisfies('>=2.15.8 <3.0.0 || >=3.10.1'));
	t.true(new Version('6.7.0-next.0').satisfies('<6.8.0'));
	t.false(new Version('3.0.0').satisfies('>=2.15.8 <3.0.0 || >=3.10.1'));
	t.false(new Version('3.10.0').satisfies('>=2.15.8 <3.0.0 || >=3.10.1'));
});

test('version.getAndValidateNewVersionFrom', t => {
	t.is(Version.getAndValidateNewVersionFrom('patch', '1.0.0'), '1.0.1');

	t.throws(
		() => Version.getAndValidateNewVersionFrom('patch', '1'),
		{message: 'Version should be a valid semver version.'}
	);

	t.throws(
		() => Version.getAndValidateNewVersionFrom('lol', '1.0.0'),
		{message: `Version should be either ${Version.SEMVER_INCREMENTS.join(', ')}, or a valid semver version.`}
	);

	t.throws(
		() => Version.getAndValidateNewVersionFrom('1.0.0', '2.0.0'),
		{message: 'New version `1.0.0` should be higher than current version `2.0.0`'}
	);
});

test('version.getAndValidateNewVersionFrom', t => {
	t.is(version.getAndValidateNewVersionFrom('patch', '1.0.0'), '1.0.1');

	t.throws(
		() => version.getAndValidateNewVersionFrom('patch', '1'),
		'Version should be a valid semver version.'
	);

	t.throws(
		() => version.getAndValidateNewVersionFrom('lol', '1.0.0'),
		`Version should be either ${version.SEMVER_INCREMENTS.join(', ')}, or a valid semver version.`
	);

	t.throws(
		() => version.getAndValidateNewVersionFrom('1.0.0', '2.0.0'),
		'New version `1.0.0` should be higher than current version `2.0.0`'
	);
});
