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

test('ignore strategy is not used', async t => {
	const testedModule = proxyquire('../source/npm/util', {
		'pkg-dir':
			{
				sync: () => path.resolve('test', 'fixtures')
			}
	});
	t.is(await testedModule.getNewAndUnpublishedFiles({name: 'no ignore strategy'}, newFiles), undefined);
});
