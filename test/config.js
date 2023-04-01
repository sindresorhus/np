import path from 'node:path';
import test from 'ava';
import sinon from 'sinon';
import esmock from 'esmock';

const testedModulePath = '../source/config.js';

const getFixture = fixture => path.resolve('test', 'fixtures', 'config', fixture);
const getFixtures = fixtures => fixtures.map(fixture => getFixture(fixture));

const getConfigsWhenGlobalBinaryIsUsed = async homedirStub => {
	const pathsPkgDir = getFixtures(['pkg-dir', 'local1', 'local2', 'local3']);

	const promises = pathsPkgDir.map(async pathPkgDir => {
		const getConfig = await esmock(testedModulePath, {
			'is-installed-globally': true,
			'pkg-dir': {packageDirectory: async () => pathPkgDir},
			'node:os': {homedir: homedirStub}
		});
		return getConfig();
	});

	return Promise.all(promises);
};

const getConfigsWhenLocalBinaryIsUsed = async pathPkgDir => {
	const homedirs = getFixtures(['homedir1', 'homedir2', 'homedir3']);

	const promises = homedirs.map(async homedir => {
		const getConfig = await esmock(testedModulePath, {
			'is-installed-globally': false,
			'pkg-dir': {packageDirectory: async () => pathPkgDir},
			'node:os': {homedir: () => homedir}
		});
		return getConfig();
	});

	return Promise.all(promises);
};

const useGlobalBinary = test.macro(async (t, homedir, source) => {
	const homedirStub = sinon.stub().returns(getFixture(homedir));
	const configs = await getConfigsWhenGlobalBinaryIsUsed(homedirStub);

	for (const config of configs) {
		t.deepEqual(config, {source});
	}
});

const useLocalBinary = test.macro(async (t, pkgDir, source) => {
	const configs = await getConfigsWhenLocalBinaryIsUsed(getFixture(pkgDir));

	for (const config of configs) {
		t.deepEqual(config, {source});
	}
});

test('returns config from home directory when global binary is used and .np-config-json exists in home directory',
	useGlobalBinary, 'homedir1', 'homedir/.np-config.json'
);

test.failing('returns config from home directory when global binary is used and `.np-config.js` exists in home directory',
	useGlobalBinary, 'homedir2', 'homedir/.np-config.js'
);

test('returns config from home directory when global binary is used and `.np-config.cjs` exists in home directory',
	useGlobalBinary, 'homedir3', 'homedir/.np-config.cjs'
);

test('returns config from package directory when local binary is used and `package.json` exists in package directory',
	useLocalBinary, 'pkg-dir', 'package.json'
);

test('returns config from package directory when local binary is used and `.np-config.json` exists in package directory',
	useLocalBinary, 'local1', 'packagedir/.np-config.json'
);

test.failing('returns config from package directory when local binary is used and `.np-config.js` exists in package directory',
	useLocalBinary, 'local2', 'packagedir/.np-config.js'
);

test('returns config from package directory when local binary is used and `.np-config.cjs` exists in package directory',
	useLocalBinary, 'local3', 'packagedir/.np-config.cjs'
);
