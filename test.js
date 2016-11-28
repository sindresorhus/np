import readPkgUp from 'read-pkg-up';
import test from 'ava';
import m from './';

const pkg = readPkgUp.sync().pkg;

test('version is invalid', t => {
	const message = 'Version should be either patch, minor, major, prepatch, preminor, premajor, prerelease, or a valid semver version.';
	t.throws(m('foo'), message);
	t.throws(m('4.x.3'), message);
});

test('version is pre-release', t => {
	const message = 'You must specify a dist-tag using --tag when publishing a pre-release version. This prevents accidentally tagging unstable versions as "latest". https://docs.npmjs.com/cli/dist-tag';
	t.throws(m('premajor', pkg), message);
	t.throws(m('preminor', pkg), message);
	t.throws(m('prepatch', pkg), message);
	t.throws(m('prerelease', pkg), message);
	t.throws(m('10.0.0-0', pkg), message);
	t.throws(m('10.0.0-beta', pkg), message);
});

test('errors on too low version', t => {
	t.throws(m('1.0.0', pkg), /New version `1\.0\.0` should be higher than current version `\d+\.\d+\.\d+`/);
	t.throws(m('1.0.0-beta', pkg), /New version `1\.0\.0-beta` should be higher than current version `\d+\.\d+\.\d+`/);
});
