import path from 'node:path';
import fs from 'node:fs/promises';
import test from 'ava';
import esmock from 'esmock';
import {runIfExists} from './_utils.js';

const getFixture = name => path.resolve('test', 'fixtures', 'files', name);

const mockPkgDir = test.macro(async (t, fixture, expectedFiles, {before, after} = {}) => {
	const fixtureDir = getFixture(fixture);

	await runIfExists(before, fixtureDir);

	const npmUtil = await esmock('../source/npm/util.js', {
		'pkg-dir': {packageDirectory: async () => fixtureDir},
	});

	const files = await npmUtil.getFilesToBePacked();
	t.deepEqual(files.sort(), expectedFiles.sort(), 'Files different from expectations!');

	await runIfExists(after, fixtureDir);
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

const renameDotGitignore = {
	async before(fixtureDir) {
		await fs.rename(`${fixtureDir}/gitignore`, `${fixtureDir}/.gitignore`);
	},
	async after(fixtureDir) {
		await fs.rename(`${fixtureDir}/.gitignore`, `${fixtureDir}/gitignore`);
	},
};

test('package.json files field and gitignore', mockPkgDir, 'gitignore', [
	'package.json',
	'readme.md',
	'dist/index.js',
], renameDotGitignore);

test('npmignore and gitignore', mockPkgDir, 'npmignore-and-gitignore', [
	'package.json',
	'readme.md',
	'dist/index.js',
], renameDotGitignore);

test('package.json main field not in files field', mockPkgDir, 'main', [
	'package.json',
	'foo.js',
	'bar.js',
]);

