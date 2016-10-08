import test from 'ava';
import {SEMVER_INCREMENTS, PRERELEASE_VERSIONS, isValidVersionInput, isPrereleaseVersion, getNewVersion, isVersionGreater, isVersionLower, satisfies} from '../lib/version';

test('SEMVER_INCREMENTS', t => {
	t.deepEqual(SEMVER_INCREMENTS, ['patch', 'minor', 'major', 'prepatch', 'preminor', 'premajor', 'prerelease']);
});

test('PRERELEASE_VERSIONS', t => {
	t.deepEqual(PRERELEASE_VERSIONS, ['prepatch', 'preminor', 'premajor', 'prerelease']);
});

test('isValidVersionInput', t => {
	t.false(isValidVersionInput(null));
	t.false(isValidVersionInput('foo'));
	t.false(isValidVersionInput('1.0.0.0'));

	t.true(isValidVersionInput('patch'));
	t.true(isValidVersionInput('minor'));
	t.true(isValidVersionInput('major'));
	t.true(isValidVersionInput('prepatch'));
	t.true(isValidVersionInput('preminor'));
	t.true(isValidVersionInput('premajor'));
	t.true(isValidVersionInput('prerelease'));
	t.true(isValidVersionInput('1.0.0'));
	t.true(isValidVersionInput('1.1.0'));
	t.true(isValidVersionInput('1.0.1'));
	t.true(isValidVersionInput('1.0.0-beta'));
	t.true(isValidVersionInput('2.0.0-rc.2'));
});

test('isPrereleaseVersion', t => {
	t.false(isPrereleaseVersion('patch'));
	t.false(isPrereleaseVersion('minor'));
	t.false(isPrereleaseVersion('major'));
	t.false(isPrereleaseVersion('1.0.0'));
	t.false(isPrereleaseVersion('1.1.0'));
	t.false(isPrereleaseVersion('1.0.1'));

	t.true(isPrereleaseVersion('prepatch'));
	t.true(isPrereleaseVersion('preminor'));
	t.true(isPrereleaseVersion('premajor'));
	t.true(isPrereleaseVersion('prerelease'));
	t.true(isPrereleaseVersion('1.0.0-beta'));
	t.true(isPrereleaseVersion('2.0.0-rc.2'));
});

test('getNewVersion', t => {
	const message = 'Version should be either patch, minor, major, prepatch, preminor, premajor, prerelease or a valid semver version.';

	t.throws(() => getNewVersion('1.0.0', 'patchxxx'), message);
	t.throws(() => getNewVersion('1.0.0', '1.0.0.0'), message);

	t.is(getNewVersion('1.0.0', 'patch'), '1.0.1');
	t.is(getNewVersion('1.0.0', 'minor'), '1.1.0');
	t.is(getNewVersion('1.0.0', 'major'), '2.0.0');

	t.is(getNewVersion('1.0.0-beta', 'major'), '1.0.0');
	t.is(getNewVersion('1.0.0', 'prepatch'), '1.0.1-0');
	t.is(getNewVersion('1.0.1-0', 'prepatch'), '1.0.2-0');

	t.is(getNewVersion('1.0.0-0', 'prerelease'), '1.0.0-1');
	t.is(getNewVersion('1.0.1-0', 'prerelease'), '1.0.1-1');
});

test('isVersionGreater', t => {
	const message = 'Version should be a valid semver version.';

	t.throws(() => isVersionGreater('1.0.0', 'patch'), message);
	t.throws(() => isVersionGreater('1.0.0', 'patchxxx'), message);
	t.throws(() => isVersionGreater('1.0.0', '1.0.0.0'), message);

	t.false(isVersionGreater('1.0.0', '0.0.1'));
	t.false(isVersionGreater('1.0.0', '0.1.0'));
	t.false(isVersionGreater('1.0.0', '1.0.0'));

	t.false(isVersionGreater('1.0.0', '1.0.0-0'));
	t.false(isVersionGreater('1.0.0', '1.0.0-beta'));

	t.true(isVersionGreater('1.0.0', '1.0.1'));
	t.true(isVersionGreater('1.0.0', '1.1.0'));
	t.true(isVersionGreater('1.0.0', '2.0.0'));

	t.true(isVersionGreater('1.0.0', '2.0.0-0'));
	t.true(isVersionGreater('1.0.0', '2.0.0-beta'));
});

test('isVersionLower', t => {
	const message = 'Version should be a valid semver version.';

	t.throws(() => isVersionLower('1.0.0', 'patch'), message);
	t.throws(() => isVersionLower('1.0.0', 'patchxxx'), message);
	t.throws(() => isVersionLower('1.0.0', '1.0.0.0'), message);

	t.true(isVersionLower('1.0.0', '0.0.1'));
	t.true(isVersionLower('1.0.0', '0.1.0'));
	t.true(isVersionLower('1.0.0', '1.0.0-0'));
	t.true(isVersionLower('1.0.0', '1.0.0-beta'));

	t.false(isVersionLower('1.0.0', '1.0.0'));
	t.false(isVersionLower('1.0.0', '1.0.1'));
	t.false(isVersionLower('1.0.0', '1.1.0'));
	t.false(isVersionLower('1.0.0', '2.0.0'));

	t.false(isVersionLower('1.0.0', '2.0.0-0'));
	t.false(isVersionLower('1.0.0', '2.0.0-beta'));
});

test('satisfies', t => {
	t.true(satisfies('2.15.8', '>=2.15.8 <3.0.0 || >=3.10.1'));
	t.true(satisfies('2.99.8', '>=2.15.8 <3.0.0 || >=3.10.1'));
	t.true(satisfies('3.10.1', '>=2.15.8 <3.0.0 || >=3.10.1'));
	t.false(satisfies('3.0.0', '>=2.15.8 <3.0.0 || >=3.10.1'));
	t.false(satisfies('3.10.0', '>=2.15.8 <3.0.0 || >=3.10.1'));
});
