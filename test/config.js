import path from 'path';
import os from 'os';
import test from 'ava';
import sinon from 'sinon';
import proxyquire from 'proxyquire';

const stubOs = sinon.stub(os, 'homedir');

test('should return config from `.np-config.json` when installed globally', async t => {
	stubOs.returns(path.resolve('test', 'fixtures', 'homedir1'));
	const config = proxyquire('../source/config', {
		'is-installed-globally': true,
		'pkg-dir': async () => {}
	});
	t.deepEqual(await config(), {yarn: false});
});

test('should return config from `.np-config.js` when installed globally', async t => {
	stubOs.returns(path.resolve('test', 'fixtures', 'homedir2'));
	const config = proxyquire('../source/config', {
		'is-installed-globally': true,
		'pkg-dir': async () => {}
	});
	t.deepEqual(await config(), {yarn: true, contents: 'dist'});
});

test('should return config from `package.json` when installed localy', async t => {
	const config = proxyquire('../source/config', {
		'is-installed-globally': false,
		'pkg-dir': async () => {
			return path.resolve('test', 'fixtures', 'pkg-dir');
		}
	});
	t.deepEqual(await config(), {yarn: true});
});
