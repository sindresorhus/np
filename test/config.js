import path from 'path';
import test from 'ava';
import sinon from 'sinon';
import proxyquire from 'proxyquire';

const fixtureBasePath = path.resolve('test', 'fixtures', 'config');

const getConfigsWhenGlobalBinaryIsUsed = async homedirStub => {
	const pathsPkgDir = [path.resolve(fixtureBasePath, 'pkg-dir'),
		path.resolve(fixtureBasePath, 'local1'),
		path.resolve(fixtureBasePath, 'local2')];

	const promises = [];
	pathsPkgDir.forEach(pathPkgDir => {
		promises.push(proxyquire('../source/config', {
			'is-installed-globally': true,
			'pkg-dir': async () => {
				return pathPkgDir;
			},
			os: {
				homedir: homedirStub
			}
		})());
	});
	return Promise.all(promises);
};

const getConfigsWhenLocalBinaryIsUsed = async pathPkgDir => {
	const homedirs = [path.resolve(fixtureBasePath, 'homedir1'),
		path.resolve(fixtureBasePath, 'homedir2')];

	const promises = [];
	homedirs.forEach(homedir => {
		promises.push(proxyquire('../source/config', {
			'is-installed-globally': false,
			'pkg-dir': async () => {
				return pathPkgDir;
			},
			os: {
				homedir: () => {
					return homedir;
				}
			}
		})());
	});
	return Promise.all(promises);
};

test('returns config from home directory when global binary is used and `.np-config-json` exists in home directory', async t => {
	const homedirStub = sinon.stub();
	homedirStub.returns(path.resolve(fixtureBasePath, 'homedir1'));
	const configs = await getConfigsWhenGlobalBinaryIsUsed(homedirStub);
	configs.forEach(config => t.deepEqual(config, {source: 'homedir/.np-config.json'}));
});

test('returns config from home directory when global binary is used and `.np-config.js` exists in home directory', async t => {
	const homedirStub = sinon.stub();
	homedirStub.returns(path.resolve(fixtureBasePath, 'homedir2'));
	const configs = await getConfigsWhenGlobalBinaryIsUsed(homedirStub);
	configs.forEach(config => t.deepEqual(config, {source: 'homedir/.np-config.js'}));
});

test('returns config from package directory when local binary is used and `package.json` exists in package directory', async t => {
	const configs = await getConfigsWhenLocalBinaryIsUsed(path.resolve(fixtureBasePath, 'pkg-dir'));
	configs.forEach(config => t.deepEqual(config, {source: 'package.json'}));
});

test('returns config from package directory when local binary is used and `.np-config.json` exists in package directory', async t => {
	const configs = await getConfigsWhenLocalBinaryIsUsed(path.resolve(fixtureBasePath, 'local1'));
	configs.forEach(config => t.deepEqual(config, {source: 'packagedir/.np-config.json'}));
});

test('returns config from package directory when local binary is used and `.np-config.js` exists in package directory', async t => {
	const configs = await getConfigsWhenLocalBinaryIsUsed(path.resolve(fixtureBasePath, 'local2'));
	configs.forEach(config => t.deepEqual(config, {source: 'packagedir/.np-config.js'}));
});
