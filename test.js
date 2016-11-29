import test from 'ava';
import m from './';

test('version is invalid', t => {
	const message = 'Version should be either patch, minor, major, prepatch, preminor, premajor, prerelease, or a valid semver version.';
	t.throws(m('foo'), message);
	t.throws(m('4.x.3'), message);
});

test('version is pre-release', t => {
	const message = 'You must specify a dist-tag using --tag when publishing a pre-release version. This prevents accidentally tagging unstable versions as "latest". https://docs.npmjs.com/cli/dist-tag';
	t.throws(m('premajor'), message);
	t.throws(m('preminor'), message);
	t.throws(m('prepatch'), message);
	t.throws(m('prerelease'), message);
	t.throws(m('10.0.0-0'), message);
	t.throws(m('10.0.0-beta'), message);
});

test('errors on too low version', t => {
	t.throws(m('1.0.0'), /New version `1\.0\.0` should be higher than current version `\d+\.\d+\.\d+`/);
	t.throws(m('1.0.0-beta'), /New version `1\.0\.0-beta` should be higher than current version `\d+\.\d+\.\d+`/);
});
