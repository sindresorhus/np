import path from 'node:path';
import test from 'ava';
import esmock from 'esmock';

const getFixture = name => path.resolve('test', 'fixtures', 'files', name);

const mockPkgDir = test.macro(async (t, fixture, expectedFiles) => {
	const npmUtil = await esmock('../source/npm/util.js', {
		'pkg-dir': {packageDirectory: async () => getFixture(fixture)},
	});

	const files = await npmUtil.getFilesToBePacked();
	t.deepEqual(files.sort(), expectedFiles.sort(), 'Files different from expectations!');
});

test('package.json files field - one file', mockPkgDir, 'one-file', [
	'package.json',
	'index.js',
]);

test('package.json files field - source dir', mockPkgDir, 'source-dir', [
	'package.json',
	'source/foo.js',
	'source/bar.js',
]);

test('package.json files field - source and dist dirs', mockPkgDir, 'source-and-dist-dir', [
	'package.json',
	'source/foo.js',
	'source/bar.js',
]);

test('package.json files field - leading slash', mockPkgDir, 'files-slash', [
	'package.json',
	'index.js',
]);

test('package.json files field - has readme and license', mockPkgDir, 'has-readme-and-license', [
	'package.json',
	'readme.md',
	'license.md',
	'index.js',
]);

test('npmignore', mockPkgDir, 'npmignore', [
	'package.json',
	'readme.md',
	'index.js',
	'index.d.ts',
]);

test('package.json files field and npmignore', mockPkgDir, 'files-and-npmignore', [
	'package.json',
	'readme.md',
	'source/foo.js',
	'source/bar.js',
	'source/index.d.ts',
]);

test('package.json files field and gitignore', mockPkgDir, 'gitignore', [
	'package.json',
	'readme.md',
	'dist/index.js',
]);

test('npmignore and gitignore', mockPkgDir, 'npmignore-and-gitignore', [
	'package.json',
	'readme.md',
	'dist/index.js',
]);

test('package.json main field not in files field', mockPkgDir, 'main', [
	'package.json',
	'foo.js',
	'bar.js',
]);

