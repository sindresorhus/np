import test from 'ava';
import np from '../source';

const defaultOptions = {
	cleanup: true,
	tests: true,
	publish: true,
	runPublish: true
};

test('version is invalid', async t => {
	const message = 'Version should be either patch, minor, major, prepatch, preminor, premajor, prerelease, or a valid semver version.';
	await t.throwsAsync(np('foo', defaultOptions), message);
	await t.throwsAsync(np('4.x.3', defaultOptions), message);
});

test('version is pre-release', async t => {
	const message = 'You must specify a dist-tag using --tag when publishing a pre-release version. This prevents accidentally tagging unstable versions as "latest". https://docs.npmjs.com/cli/dist-tag';
	await t.throwsAsync(np('premajor', defaultOptions), message);
	await t.throwsAsync(np('preminor', defaultOptions), message);
	await t.throwsAsync(np('prepatch', defaultOptions), message);
	await t.throwsAsync(np('prerelease', defaultOptions), message);
	await t.throwsAsync(np('10.0.0-0', defaultOptions), message);
	await t.throwsAsync(np('10.0.0-beta', defaultOptions), message);
});

test('errors on too low version', async t => {
	await t.throwsAsync(np('1.0.0', defaultOptions), /New version `1\.0\.0` should be higher than current version `\d+\.\d+\.\d+`/);
	await t.throwsAsync(np('1.0.0-beta', defaultOptions), /New version `1\.0\.0-beta` should be higher than current version `\d+\.\d+\.\d+`/);
});
