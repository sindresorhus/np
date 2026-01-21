import path from 'node:path';
import test from 'ava';
import esmock from 'esmock';
import {readPackage} from '../source/util.js';

const testedModulePath = '../source/config.js';

const getFixture = fixture => path.resolve('test', 'fixtures', 'config', fixture);

const getConfigWhenGlobalBinaryIsUsed = async pathPackageDirectory => {
	const getConfig = await esmock(testedModulePath, {
		'is-installed-globally': true,
	});
	return getConfig(pathPackageDirectory);
};

const getConfigWhenLocalBinaryIsUsed = async pathPackageDirectory => {
	const getConfig = await esmock(testedModulePath, {
		'is-installed-globally': false,
	});
	return getConfig(pathPackageDirectory);
};

const useGlobalBinary = test.macro(async (t, packageDirectory, source) => {
	const config = await getConfigWhenGlobalBinaryIsUsed(getFixture(packageDirectory));
	t.deepEqual(config, {source});
});

const useLocalBinary = test.macro(async (t, packageDirectory, source) => {
	const config = await getConfigWhenLocalBinaryIsUsed(getFixture(packageDirectory));
	t.deepEqual(config, {source});
});

test(
	'returns config from package directory when global binary is used and `package.json` exists in package directory',
	useGlobalBinary,
	'pkg-dir',
	'package.json',
);

test(
	'returns config from package directory when global binary is used and `.np-config.json` exists in package directory',
	useGlobalBinary,
	'local1',
	'packagedir/.np-config.json',
);

test(
	'returns config from package directory when global binary is used and `.np-config.js` as CJS exists in package directory',
	useGlobalBinary,
	'local2',
	'packagedir/.np-config.js',
);

test(
	'returns config from package directory when global binary is used and `.np-config.cjs` exists in package directory',
	useGlobalBinary,
	'local3',
	'packagedir/.np-config.cjs',
);

test(
	'returns config from package directory when global binary is used and `.np-config.js` as ESM exists in package directory',
	useGlobalBinary,
	'local4',
	'packagedir/.np-config.js',
);

test(
	'returns config from package directory when global binary is used and `.np-config.mjs` exists in package directory',
	useGlobalBinary,
	'local5',
	'packagedir/.np-config.mjs',
);

test('global binary merges global and project config with project taking precedence', async t => {
	const fixtureDirectory = getFixture('pkg-dir');

	// Create a temporary home directory with global config
	const temporaryHome = getFixture('homedir1');

	const getConfig = await esmock(testedModulePath, {
		'is-installed-globally': true,
		'node:os': {homedir: () => temporaryHome},
	});

	const config = await getConfig(fixtureDirectory);

	// Should have project config
	t.is(config.source, 'package.json');
});

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

test('`contents` option in config allows reading package from subdirectory', async t => {
	const fixtureDirectory = getFixture('contents-option');

	// Load config from fixture directory (simulates loading from process.cwd())
	const getConfig = await esmock(testedModulePath, {
		'is-installed-globally': false,
	});

	const config = await getConfig(fixtureDirectory);

	// Config should have contents option
	t.is(config.contents, 'dist');

	// Using contents from config should read package from subdirectory
	const contentsPath = path.join(fixtureDirectory, config.contents);
	const {package_, rootDirectory} = await readPackage(contentsPath);

	t.is(package_.name, 'from-dist');
	t.is(rootDirectory, contentsPath);
});
