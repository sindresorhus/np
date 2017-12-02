import test from 'ava';
import m from '..';

test('version is invalid', async t => {
	const message = 'Version should be either patch, minor, major, prepatch, preminor, premajor, prerelease, or a valid semver version.';
	await t.throws(m('foo'), message);
	await t.throws(m('4.x.3'), message);
});

test('version is pre-release', async t => {
	const message = 'You must specify a dist-tag using --tag when publishing a pre-release version. This prevents accidentally tagging unstable versions as "latest". https://docs.npmjs.com/cli/dist-tag';
	await t.throws(m('premajor'), message);
	await t.throws(m('preminor'), message);
	await t.throws(m('prepatch'), message);
	await t.throws(m('prerelease'), message);
	await t.throws(m('10.0.0-0'), message);
	await t.throws(m('10.0.0-beta'), message);
});

test('errors on too low version', async t => {
	await t.throws(m('1.0.0'), /New version `1\.0\.0` should be higher than current version `\d+\.\d+\.\d+`/);
	await t.throws(m('1.0.0-beta'), /New version `1\.0\.0-beta` should be higher than current version `\d+\.\d+\.\d+`/);
});
