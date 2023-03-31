import path from 'path';
import test from 'ava';
import proxyquire from 'proxyquire';

const source = '../source/npm/util';

const getFixture = name => path.resolve('test', 'fixtures', 'files', name);

const checkPackedFiles = async (t, fixture, expectedFiles) => {
	const npmUtil = proxyquire(source, {
		'pkg-dir': () => getFixture(fixture)
	});

	const files = await npmUtil.getFilesToBePacked();
	t.deepEqual(files.sort(), expectedFiles.sort(), 'Files different from expectations!');
};

test.serial('package.json files field - one file', async t => {
	await checkPackedFiles(t, 'one-file', [
		'package.json',
		'index.js'
	]);
});

test.serial('package.json files field - source dir', async t => {
	await checkPackedFiles(t, 'source-dir', [
		'package.json',
		'source/foo.js',
		'source/bar.js'
	]);
});

test.serial('package.json files field - source and dist dirs', async t => {
	await checkPackedFiles(t, 'source-and-dist-dir', [
		'package.json',
		'source/foo.js',
		'source/bar.js'
	]);
});

test.serial('package.json files field - has readme', async t => {
	await checkPackedFiles(t, 'has-readme', [
		'package.json',
		'readme.md',
		'index.js'
	]);
});

test.serial('npmignore', async t => {
	await checkPackedFiles(t, 'npmignore', [
		'package.json',
		'readme.md',
		'index.js',
		'index.d.ts'
	]);
});

test.serial('package.json files field and npmignore', async t => {
	await checkPackedFiles(t, 'files-and-npmignore', [
		'package.json',
		'readme.md',
		'source/foo.js',
		'source/bar.js',
		'source/index.d.ts'
	]);
});

test.serial('package.json files field and gitignore', async t => {
	await checkPackedFiles(t, 'gitignore', [
		'package.json',
		'readme.md',
		'dist/index.js'
	]);
});

test.serial('npmignore and gitignore', async t => {
	await checkPackedFiles(t, 'npmignore-and-gitignore', [
		'package.json',
		'readme.md',
		'dist/index.js'
	]);
});
