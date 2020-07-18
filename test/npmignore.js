import path from 'path';
import test from 'ava';
import proxyquire from 'proxyquire';

const newFiles = [
	'source/ignore.txt',
	'source/pay_attention.txt',
	'.hg',
	'test/file.txt'
];

test('ignored files using file-attribute in package.json with one file', async t => {
	const testedModule = proxyquire('../source/npm/util', {
		'pkg-dir':
			{
				sync: () => path.resolve('test', 'fixtures', 'package')
			}
	});
	t.deepEqual(await testedModule.getNewAndUnpublishedFiles(['pay_attention.txt'], newFiles),
		['source/ignore.txt', 'test/file.txt']);
});

test('ignored file using file-attribute in package.json with directory', async t => {
	const testedModule = proxyquire('../source/npm/util', {
		'pkg-dir':
			{
				sync: () => path.resolve('test', 'fixtures', 'package')
			}
	});
	t.deepEqual(await testedModule.getNewAndUnpublishedFiles(['source'], newFiles), ['test/file.txt']);
});

test('ignored files using .npmignore', async t => {
	const testedModule = proxyquire('../source/npm/util', {
		'pkg-dir':
			{
				sync: () => path.resolve('test', 'fixtures', 'npmignore')
			}
	});
	t.deepEqual(await testedModule.getNewAndUnpublishedFiles(undefined, newFiles), ['source/ignore.txt', 'test/file.txt']);
});

test('ignore strategy is not used', async t => {
	const testedModule = proxyquire('../source/npm/util', {
		'pkg-dir':
			{
				sync: () => path.resolve('test', 'fixtures')
			}
	});
	t.is(await testedModule.getNewAndUnpublishedFiles(undefined, newFiles), undefined);
});
