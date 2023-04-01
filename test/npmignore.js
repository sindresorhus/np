import path from 'node:path';
import test from 'ava';
import esmock from 'esmock';

const newFiles = [
	'source/ignore.txt',
	'source/pay_attention.txt',
	'.hg',
	'test/file.txt',
	'readme.md',
	'README.txt'
];

const mockPkgDir = test.macro(async (t, paths, impl) => {
	const testedModule = await esmock('../source/npm/util.js', {
		'pkg-dir': {packageDirectorySync: () => path.resolve(...paths)}
	});

	await impl(t, testedModule);
});

test.serial('ignored files using file-attribute in package.json with one file', mockPkgDir, ['test', 'fixtures', 'package'],
	async (t, {getNewAndUnpublishedFiles}) => {
		t.deepEqual(await getNewAndUnpublishedFiles({files: ['pay_attention.txt']}, newFiles), ['source/ignore.txt']);
	}
);

test.serial('ignored file using file-attribute in package.json with directory', mockPkgDir, ['test', 'fixtures', 'package'],
	async (t, {getNewAndUnpublishedFiles}) => {
		t.deepEqual(await getNewAndUnpublishedFiles({files: ['source']}, newFiles), []);
	}
);

test.serial('ignored test files using files attribute and directory structure in package.json', mockPkgDir, ['test', 'fixtures', 'package'],
	async (t, {getNewAndUnpublishedFiles}) => {
		t.deepEqual(await getNewAndUnpublishedFiles({files: ['source'], directories: {test: 'test-tap'}}, newFiles), ['test/file.txt']);
		t.deepEqual(await getNewAndUnpublishedFiles({files: ['source'], directories: {test: ['test-tap']}}, newFiles), ['test/file.txt']);
	}
);

test.serial('ignored files using .npmignore', mockPkgDir, ['test', 'fixtures', 'npmignore'],
	async (t, {getNewAndUnpublishedFiles}) => {
		t.deepEqual(await getNewAndUnpublishedFiles({name: 'npmignore'}, newFiles), ['source/ignore.txt']);
	}
);

test.serial('ignored test files using files attribute and .npmignore', mockPkgDir, ['test', 'fixtures', 'npmignore'],
	async (t, {getNewAndUnpublishedFiles}) => {
		t.deepEqual(await getNewAndUnpublishedFiles({directories: {test: 'test-tap'}}, newFiles), ['source/ignore.txt', 'test/file.txt']);
		t.deepEqual(await getNewAndUnpublishedFiles({directories: {test: ['test-tap']}}, newFiles), ['source/ignore.txt', 'test/file.txt']);
	}
);

test.serial('ignored files - dot files using files attribute', mockPkgDir, ['test', 'fixtures', 'package'],
	async (t, {getNewAndUnpublishedFiles}) => {
		t.deepEqual(await getNewAndUnpublishedFiles({files: ['source']}, ['test/.dotfile']), []);
	}
);

test.serial('ignored files - dot files using .npmignore', mockPkgDir, ['test', 'fixtures', 'npmignore'],
	async (t, {getNewAndUnpublishedFiles}) => {
		t.deepEqual(await getNewAndUnpublishedFiles({}, ['test/.dot']), []);
	}
);

test.serial('ignored files - ignore strategy is not used', mockPkgDir, ['test', 'fixtures'],
	async (t, {getNewAndUnpublishedFiles}) => {
		t.deepEqual(await getNewAndUnpublishedFiles({name: 'no ignore strategy'}, newFiles), []);
	}
);

test.serial('first time published files using file-attribute in package.json with one file', mockPkgDir, ['test', 'fixtures', 'package'],
	async (t, {getFirstTimePublishedFiles}) => {
		t.deepEqual(await getFirstTimePublishedFiles({files: ['pay_attention.txt']}, newFiles), ['source/pay_attention.txt']);
	}
);

test.serial('first time published files using file-attribute in package.json with directory', mockPkgDir, ['test', 'fixtures', 'package'],
	async (t, {getFirstTimePublishedFiles}) => {
		t.deepEqual(await getFirstTimePublishedFiles({files: ['source']}, newFiles), ['source/ignore.txt', 'source/pay_attention.txt']);
	}
);

test.serial('first time published files using .npmignore', mockPkgDir, ['test', 'fixtures', 'npmignore'],
	async (t, {getFirstTimePublishedFiles}) => {
		t.deepEqual(await getFirstTimePublishedFiles({name: 'npmignore'}, newFiles), ['source/pay_attention.txt']);
	}
);

test.serial('first time published dot files using files attribute', mockPkgDir, ['test', 'fixtures', 'package'],
	async (t, {getFirstTimePublishedFiles}) => {
		t.deepEqual(await getFirstTimePublishedFiles({files: ['source']}, ['source/.dotfile']), ['source/.dotfile']);
	}
);

test.serial('first time published dot files using .npmignore', mockPkgDir, ['test', 'fixtures', 'npmignore'],
	async (t, {getFirstTimePublishedFiles}) => {
		t.deepEqual(await getFirstTimePublishedFiles({}, ['source/.dotfile']), ['source/.dotfile']);
	}
);

test.serial('first time published files - ignore strategy is not used', mockPkgDir, ['test', 'fixtures'],
	async (t, {getFirstTimePublishedFiles}) => {
		t.deepEqual(await getFirstTimePublishedFiles({name: 'no ignore strategy'}, newFiles), ['source/ignore.txt', 'source/pay_attention.txt', 'test/file.txt']);
	}
);

test.serial('first time published files - empty files property', mockPkgDir, ['test', 'fixtures', 'package'],
	async (t, {getFirstTimePublishedFiles}) => {
		t.deepEqual(await getFirstTimePublishedFiles({files: []}, newFiles), []);
	}
);

test.serial('first time published files - .npmignore excludes everything', mockPkgDir, ['test', 'fixtures', 'npmignore'],
	async (t, {getFirstTimePublishedFiles}) => {
		t.deepEqual(await getFirstTimePublishedFiles({name: 'excluded everything'}, ['source/ignore.txt']), []);
	}
);
