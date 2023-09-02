import path from 'node:path';
import test from 'ava';
import {getFilesToBePacked} from '../../../source/npm/util.js';
import {runIfExists} from '../../_helpers/util.js';

const getFixture = name => path.resolve('test', 'fixtures', 'files', name);

const verifyPackedFiles = test.macro(async (t, fixture, expectedFiles, {before, after} = {}) => {
	const fixtureDir = getFixture(fixture);

	await runIfExists(before, fixtureDir);
	t.teardown(async () => runIfExists(after, fixtureDir));

	const files = await getFilesToBePacked(fixtureDir);
	t.deepEqual(files.sort(), [...expectedFiles, 'package.json'].sort(), 'Files different from expectations!');
});

test('package.json files field - one file', verifyPackedFiles, 'one-file', [
	'index.js',
]);

test('package.json files field - source dir', verifyPackedFiles, 'source-dir', [
	'source/foo.js',
	'source/bar.js',
]);

test('package.json files field - source and dist dirs', verifyPackedFiles, 'source-and-dist-dir', [
	'source/foo.js',
	'source/bar.js',
]);

test('package.json files field - leading slash', verifyPackedFiles, 'files-slash', [
	'index.js',
]);

test('package.json files field - has readme and license', verifyPackedFiles, 'has-readme-and-license', [
	'readme.md',
	'license.md',
	'index.js',
]);

test('npmignore', verifyPackedFiles, 'npmignore', [
	'readme.md',
	'index.js',
	'index.d.ts',
]);

test('package.json files field and npmignore', verifyPackedFiles, 'files-and-npmignore', [
	'readme.md',
	'source/foo.js',
	'source/bar.js',
	'source/index.d.ts',
]);

test('package.json files field and gitignore', verifyPackedFiles, 'gitignore', [
	'readme.md',
	'dist/index.js',
]);

test('npmignore and gitignore', verifyPackedFiles, 'npmignore-and-gitignore', [
	'readme.md',
	'dist/index.js',
]);

test('package.json main field not in files field', verifyPackedFiles, 'main', [
	'foo.js',
	'bar.js',
]);

test('doesn\'t show files in .github', verifyPackedFiles, 'dot-github', [
	'index.js',
]);

