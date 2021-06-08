import path from 'path';
import test from 'ava';
import proxyquire from 'proxyquire';

const newFiles = [
	'source/ignore.txt',
	'source/pay_attention.txt',
	'.hg',
	'test/file.txt',
	'readme.md',
	'README.txt'
];

test('ignored files using file-attribute in package.json with one file', async t => {
	const testedModule = proxyquire('../source/npm/util', {
		'pkg-dir':
			{
				sync: () => path.resolve('test', 'fixtures', 'package')
			}
	});
	t.deepEqual(await testedModule.getNewAndUnpublishedFiles({files: ['pay_attention.txt']}, newFiles), ['source/ignore.txt']);
});

test('ignored file using file-attribute in package.json with directory', async t => {
	const testedModule = proxyquire('../source/npm/util', {
		'pkg-dir':
			{
				sync: () => path.resolve('test', 'fixtures', 'package')
			}
	});
	t.deepEqual(await testedModule.getNewAndUnpublishedFiles({files: ['source']}, newFiles), []);
});

test('ignored test files using files attribute and directory structure in package.json', async t => {
	const testedModule = proxyquire('../source/npm/util', {
		'pkg-dir':
			{
				sync: () => path.resolve('test', 'fixtures', 'package')
			}
	});
	t.deepEqual(await testedModule.getNewAndUnpublishedFiles({files: ['source'], directories: {test: 'test-tap'}}, newFiles), ['test/file.txt']);
	t.deepEqual(await testedModule.getNewAndUnpublishedFiles({files: ['source'], directories: {test: ['test-tap']}}, newFiles), ['test/file.txt']);
});

test('ignored files using .npmignore', async t => {
	const testedModule = proxyquire('../source/npm/util', {
		'pkg-dir':
			{
				sync: () => path.resolve('test', 'fixtures', 'npmignore')
			}
	});
	t.deepEqual(await testedModule.getNewAndUnpublishedFiles({name: 'npmignore'}, newFiles), ['source/ignore.txt']);
});

test('ignored test files using files attribute and .npmignore', async t => {
	const testedModule = proxyquire('../source/npm/util', {
		'pkg-dir':
			{
				sync: () => path.resolve('test', 'fixtures', 'npmignore')
			}
	});
	t.deepEqual(await testedModule.getNewAndUnpublishedFiles({directories: {test: 'test-tap'}}, newFiles), ['source/ignore.txt', 'test/file.txt']);
	t.deepEqual(await testedModule.getNewAndUnpublishedFiles({directories: {test: ['test-tap']}}, newFiles), ['source/ignore.txt', 'test/file.txt']);
});

test('ignored files - dot files using files attribute', async t => {
	const testedModule = proxyquire('../source/npm/util', {
		'pkg-dir':
			{
				sync: () => path.resolve('test', 'fixtures', 'package')
			}
	});
	t.deepEqual(await testedModule.getNewAndUnpublishedFiles({files: ['source']}, ['test/.dotfile']), []);
});

test('ignored files - dot files using .npmignore', async t => {
	const testedModule = proxyquire('../source/npm/util', {
		'pkg-dir':
			{
				sync: () => path.resolve('test', 'fixtures', 'npmignore')
			}
	});
	t.deepEqual(await testedModule.getNewAndUnpublishedFiles({}, ['test/.dot']), []);
});

test('ignored files - ignore strategy is not used', async t => {
	const testedModule = proxyquire('../source/npm/util', {
		'pkg-dir':
			{
				sync: () => path.resolve('test', 'fixtures')
			}
	});
	t.is(await testedModule.getNewAndUnpublishedFiles({name: 'no ignore strategy'}, newFiles), undefined);
});

test('first time published files using file-attribute in package.json with one file', async t => {
	const testedModule = proxyquire('../source/npm/util', {
		'pkg-dir':
			{
				sync: () => path.resolve('test', 'fixtures', 'package')
			}
	});
	t.deepEqual(await testedModule.getFirstTimePublishedFiles({files: ['pay_attention.txt']}, newFiles), ['source/pay_attention.txt']);
});

test('first time published files using file-attribute in package.json with directory', async t => {
	const testedModule = proxyquire('../source/npm/util', {
		'pkg-dir':
			{
				sync: () => path.resolve('test', 'fixtures', 'package')
			}
	});
	t.deepEqual(await testedModule.getFirstTimePublishedFiles({files: ['source']}, newFiles), ['source/ignore.txt', 'source/pay_attention.txt']);
});

test('first time published files using .npmignore', async t => {
	const testedModule = proxyquire('../source/npm/util', {
		'pkg-dir':
			{
				sync: () => path.resolve('test', 'fixtures', 'npmignore')
			}
	});
	t.deepEqual(await testedModule.getFirstTimePublishedFiles({name: 'npmignore'}, newFiles), ['source/pay_attention.txt']);
});

test('first time published dot files using files attribute', async t => {
	const testedModule = proxyquire('../source/npm/util', {
		'pkg-dir':
			{
				sync: () => path.resolve('test', 'fixtures', 'package')
			}
	});
	t.deepEqual(await testedModule.getFirstTimePublishedFiles({files: ['source']}, ['source/.dotfile']), ['source/.dotfile']);
});

test('first time published dot files using .npmignore', async t => {
	const testedModule = proxyquire('../source/npm/util', {
		'pkg-dir':
			{
				sync: () => path.resolve('test', 'fixtures', 'npmignore')
			}
	});
	t.deepEqual(await testedModule.getFirstTimePublishedFiles({}, ['source/.dotfile']), ['source/.dotfile']);
});

test('first time published files - ignore strategy is not used', async t => {
	const testedModule = proxyquire('../source/npm/util', {
		'pkg-dir':
			{
				sync: () => path.resolve('test', 'fixtures')
			}
	});
	t.deepEqual(await testedModule.getFirstTimePublishedFiles({name: 'no ignore strategy'}, newFiles), ['source/ignore.txt', 'source/pay_attention.txt', 'test/file.txt']);
});

test('first time published files - empty files property', async t => {
	const testedModule = proxyquire('../source/npm/util', {
		'pkg-dir':
			{
				sync: () => path.resolve('test', 'fixtures', 'package')
			}
	});
	t.deepEqual(await testedModule.getFirstTimePublishedFiles({files: []}, newFiles), []);
});

test('first time published files - .npmignore excludes everything', async t => {
	const testedModule = proxyquire('../source/npm/util', {
		'pkg-dir':
			{
				sync: () => path.resolve('test', 'fixtures', 'npmignore')
			}
	});
	t.deepEqual(await testedModule.getFirstTimePublishedFiles({name: 'excluded everything'}, ['source/ignore.txt']), []);
});
