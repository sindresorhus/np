import test from 'ava';
import np from '../source';

test('version is invalid', async t => {
	const message = 'Version should be either patch, minor, major, prepatch, preminor, premajor, prerelease, or a valid semver version.';
	await t.throwsAsync(np('foo'), message);
	await t.throwsAsync(np('4.x.3'), message);
});

test('version is pre-release', async t => {
	const message = 'You must specify a dist-tag using --tag when publishing a pre-release version. This prevents accidentally tagging unstable versions as "latest". https://docs.npmjs.com/cli/dist-tag';
	await t.throwsAsync(np('premajor'), message);
	await t.throwsAsync(np('preminor'), message);
	await t.throwsAsync(np('prepatch'), message);
	await t.throwsAsync(np('prerelease'), message);
	await t.throwsAsync(np('10.0.0-0'), message);
	await t.throwsAsync(np('10.0.0-beta'), message);
});

test('errors on too low version', async t => {
	await t.throwsAsync(np('1.0.0'), /New version `1\.0\.0` should be higher than current version `\d+\.\d+\.\d+`/);
	await t.throwsAsync(np('1.0.0-beta'), /New version `1\.0\.0-beta` should be higher than current version `\d+\.\d+\.\d+`/);
});
