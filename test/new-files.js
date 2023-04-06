import path from 'node:path';
import test from 'ava';
import esmock from 'esmock';
import {renameFile} from 'move-file';
import {runIfExists} from './_utils.js';

const getFixture = name => path.resolve('test', 'fixtures', 'files', name);

const mockPkgDir = test.macro(async (t, fixture, expectedFiles, {before, after} = {}) => {
	const fixtureDir = getFixture(fixture);

	await runIfExists(before, fixtureDir);
	t.teardown(async () => runIfExists(after, fixtureDir));

	const npmUtil = await esmock('../source/npm/util.js', {
		'pkg-dir': {packageDirectory: async () => fixtureDir},
	});

	const files = await npmUtil.getFilesToBePacked();
	t.deepEqual(files.sort(), [...expectedFiles, 'package.json'].sort(), 'Files different from expectations!');
});

test('package.json files field - one file', mockPkgDir, 'one-file', [
	'index.js',
]);

test('package.json files field - source dir', mockPkgDir, 'source-dir', [
	'source/foo.js',
	'source/bar.js',
]);

test('package.json files field - source and dist dirs', mockPkgDir, 'source-and-dist-dir', [
	'source/foo.js',
	'source/bar.js',
]);

test('package.json files field - leading slash', mockPkgDir, 'files-slash', [
	'index.js',
]);

test('package.json files field - has readme and license', mockPkgDir, 'has-readme-and-license', [
	'readme.md',
	'license.md',
	'index.js',
]);

test('npmignore', mockPkgDir, 'npmignore', [
	'readme.md',
	'index.js',
	'index.d.ts',
]);

test('package.json files field and npmignore', mockPkgDir, 'files-and-npmignore', [
	'readme.md',
	'source/foo.js',
	'source/bar.js',
	'source/index.d.ts',
]);

const renameDotGitignore = {
	async before(fixtureDir) {
		await renameFile('gitignore', '.gitignore', {cwd: fixtureDir});
	},
	async after(fixtureDir) {
		await renameFile('.gitignore', 'gitignore', {cwd: fixtureDir});
	},
};

test('package.json files field and gitignore', mockPkgDir, 'gitignore', [
	'readme.md',
	'dist/index.js',
], renameDotGitignore);

test('npmignore and gitignore', mockPkgDir, 'npmignore-and-gitignore', [
	'readme.md',
	'dist/index.js',
], renameDotGitignore);

test('package.json main field not in files field', mockPkgDir, 'main', [
	'foo.js',
	'bar.js',
]);

test('doesn\'t show files in .github', mockPkgDir, 'dot-github', [
	'index.js',
]);

