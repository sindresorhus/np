import path from 'path';
import os from 'os';
import test from 'ava';
import sinon from 'sinon';
import proxyquire from 'proxyquire';

const homedirStub = sinon.stub(os, 'homedir');

test('should return config from `.np-config.json` in home-directory when global binary used', async t => {
	homedirStub.returns(path.resolve('test', 'fixtures', 'homedir1'));
	const config = proxyquire('../source/config', {
		'is-installed-globally': true,
		'pkg-dir': async () => {
			return path.resolve('test', 'fixtures', 'pkg-dir');
		}
	});
	t.deepEqual(await config(), {yarn: false});
});

test('should return config from `.np-config.js` in home-directory when global binary used', async t => {
	homedirStub.returns(path.resolve('test', 'fixtures', 'homedir2'));
	const config = proxyquire('../source/config', {
		'is-installed-globally': true,
		'pkg-dir': async () => {
			return path.resolve('test', 'fixtures', 'pkg-dir');
		}
	});
	t.deepEqual(await config(), {yarn: true, contents: 'dist'});
});

test('should return config from `package.json` when local binary used', async t => {
	const config = proxyquire('../source/config', {
		'is-installed-globally': false,
		'pkg-dir': async () => {
			return path.resolve('test', 'fixtures', 'pkg-dir');
		}
	});
	t.deepEqual(await config(), {yarn: true});
});

test('should only return config from home-directory when global binary used', async t => {
	homedirStub.returns(path.resolve('test', 'fixtures', 'homedir1'));
	const globalConfig = proxyquire('../source/config', {
		'is-installed-globally': true,
		'pkg-dir': async () => {
			throw new Error('access local config');
		}
	});
	const localConfig = proxyquire('../source/config', {
		'is-installed-globally': false,
		'pkg-dir': async () => {
			throw new Error('expected');
		}
	});
	t.deepEqual(await globalConfig(), {yarn: false});
	await t.throwsAsync(localConfig());
});

test('should only return config from local package when local binary used', async t => {
	const globalConfig = proxyquire('../source/config', {
		'is-installed-globally': true,
		'pkg-dir': async () => {
			return path.resolve('test', 'fixtures', 'local_config');
		},
		os: {
			homedir: () => {
				throw new Error('expected');
			}
		}
	});
	const localConfig = proxyquire('../source/config', {
		'is-installed-globally': false,
		'pkg-dir': async () => {
			return path.resolve('test', 'fixtures', 'local_config');
		},
		os: {
			homedir: () => {
				throw new Error('access global config in home-directory');
			}
		}
	});
	await t.throwsAsync(globalConfig());
	t.deepEqual(await localConfig(), {local: true});
});
