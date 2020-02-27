import path from 'path';
import test from 'ava';
import sinon from 'sinon';
import proxyquire from 'proxyquire';

const fixtureBasePath = path.resolve('test', 'fixtures', 'config');

const callConfigWhenGlobalBinaryUsed = async homedirStub => {
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

const callConfigWhenLocalBinaryUsed = async pathPkgDir => {
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

test('should always return config from home-directory when global binary used and `.np-config-json` in home-directory exists', async t => {
	const homedirStub = sinon.stub();
	homedirStub.returns(path.resolve(fixtureBasePath, 'homedir1'));
	const configs = await callConfigWhenGlobalBinaryUsed(homedirStub);
	configs.forEach(config => t.deepEqual(config, {source: 'homedir/.np-config.json'}));
});

test('should always return config from home-directory when global binary used and `.np-config.js` in home-directory exists', async t => {
	const homedirStub = sinon.stub();
	homedirStub.returns(path.resolve(fixtureBasePath, 'homedir2'));
	const configs = await callConfigWhenGlobalBinaryUsed(homedirStub);
	configs.forEach(config => t.deepEqual(config, {source: 'homedir/.np-config.js'}));
});

test('should always return config from package-directory when local binary used and `package.json` in package-directory exists', async t => {
	const configs = await callConfigWhenLocalBinaryUsed(path.resolve(fixtureBasePath, 'pkg-dir'));
	configs.forEach(config => t.deepEqual(config, {source: 'package.json'}));
});

test('should always return config from package-directory when local binary used and `.np-config.json` in package-directory exists', async t => {
	const configs = await callConfigWhenLocalBinaryUsed(path.resolve(fixtureBasePath, 'local1'));
	configs.forEach(config => t.deepEqual(config, {source: 'packagedir/.np-config.json'}));
});

test('should always return config from package-directory when local binary used and `.np-config.js` in package-directory exists', async t => {
	const configs = await callConfigWhenLocalBinaryUsed(path.resolve(fixtureBasePath, 'local2'));
	configs.forEach(config => t.deepEqual(config, {source: 'packagedir/.np-config.js'}));
});
