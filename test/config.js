import path from 'node:path';
import test from 'ava';
import esmock from 'esmock';

const testedModulePath = '../source/config.js';

const getFixture = fixture => path.resolve('test', 'fixtures', 'config', fixture);
const getFixtures = fixtures => fixtures.map(fixture => getFixture(fixture));

const getConfigsWhenGlobalBinaryIsUsed = async homeDirectory => {
	const pathsPackageDirectory = getFixtures(['package-directory', 'local1', 'local2', 'local3']);

	const promises = pathsPackageDirectory.map(async pathPackageDirectory => {
		const getConfig = await esmock(testedModulePath, {
			'is-installed-globally': true,
			'node:os': {homedir: () => homeDirectory},
		});
		return getConfig(pathPackageDirectory);
	});

	return Promise.all(promises);
};

const getConfigsWhenLocalBinaryIsUsed = async pathPackageDirectory => {
	const homeDirectories = getFixtures(['homedir1', 'homedir2', 'homedir3']);

	const promises = homeDirectories.map(async homedir => {
		const getConfig = await esmock(testedModulePath, {
			'is-installed-globally': false,
			'node:os': {homedir: () => homedir},
		});
		return getConfig(pathPackageDirectory);
	});

	return Promise.all(promises);
};

const useGlobalBinary = test.macro(async (t, homeDirectory, source) => {
	const configs = await getConfigsWhenGlobalBinaryIsUsed(getFixture(homeDirectory));

	for (const config of configs) {
		t.deepEqual(config, {source});
	}
});

const useLocalBinary = test.macro(async (t, packageDirectory, source) => {
	const configs = await getConfigsWhenLocalBinaryIsUsed(getFixture(packageDirectory));

	for (const config of configs) {
		t.deepEqual(config, {source});
	}
});

test(
	'returns config from home directory when global binary is used and .np-config-json exists in home directory',
	useGlobalBinary,
	'homedir1',
	'homedir/.np-config.json',
);

test(
	'returns config from home directory when global binary is used and `.np-config.js` as CJS exists in home directory',
	useGlobalBinary,
	'homedir2',
	'homedir/.np-config.js',
);

test(
	'returns config from home directory when global binary is used and `.np-config.cjs` exists in home directory',
	useGlobalBinary,
	'homedir3',
	'homedir/.np-config.cjs',
);

test(
	'returns config from home directory when global binary is used and `.np-config.js` as ESM exists in home directory',
	useGlobalBinary,
	'homedir4',
	'homedir/.np-config.js',
);

test(
	'returns config from home directory when global binary is used and `.np-config.mjs` exists in home directory',
	useGlobalBinary,
	'homedir5',
	'homedir/.np-config.mjs',
);

test(
	'returns config from package directory when local binary is used and `package.json` exists in package directory',
	useLocalBinary,
	'pkg-dir',
	'package.json',
);

test(
	'returns config from package directory when local binary is used and `.np-config.json` exists in package directory',
	useLocalBinary,
	'local1',
	'packagedir/.np-config.json',
);

test(
	'returns config from package directory when local binary is used and `.np-config.js` as CJS exists in package directory',
	useLocalBinary,
	'local2',
	'packagedir/.np-config.js',
);

test(
	'returns config from package directory when local binary is used and `.np-config.cjs` exists in package directory',
	useLocalBinary,
	'local3',
	'packagedir/.np-config.cjs',
);

test(
	'returns config from package directory when local binary is used and `.np-config.js` as ESM exists in package directory',
	useLocalBinary,
	'local4',
	'packagedir/.np-config.js',
);

test(
	'returns config from package directory when local binary is used and `.np-config.mjs` exists in package directory',
	useLocalBinary,
	'local5',
	'packagedir/.np-config.mjs',
);
