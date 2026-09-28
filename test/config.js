import path from 'node:path';
import test from 'node:test';
import assert from 'node:assert/strict';
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

const useGlobalBinary = (title, packageDirectory, source) => {
	test(title, async () => {
		const config = await getConfigWhenGlobalBinaryIsUsed(getFixture(packageDirectory));
		assert.deepEqual(config, {source});
	});
};

const useLocalBinary = (title, packageDirectory, source) => {
	test(title, async () => {
		const config = await getConfigWhenLocalBinaryIsUsed(getFixture(packageDirectory));
		assert.deepEqual(config, {source});
	});
};

useGlobalBinary(
	'returns config from package directory when global binary is used and `package.json` exists in package directory',
	'pkg-dir',
	'package.json',
);

useGlobalBinary(
	'returns config from package directory when global binary is used and `.np-config.json` exists in package directory',
	'local1',
	'packagedir/.np-config.json',
);

useGlobalBinary(
	'returns config from package directory when global binary is used and `.np-config.js` as CJS exists in package directory',
	'local2',
	'packagedir/.np-config.js',
);

useGlobalBinary(
	'returns config from package directory when global binary is used and `.np-config.cjs` exists in package directory',
	'local3',
	'packagedir/.np-config.cjs',
);

useGlobalBinary(
	'returns config from package directory when global binary is used and `.np-config.js` as ESM exists in package directory',
	'local4',
	'packagedir/.np-config.js',
);

useGlobalBinary(
	'returns config from package directory when global binary is used and `.np-config.mjs` exists in package directory',
	'local5',
	'packagedir/.np-config.mjs',
);

test('global binary merges global and project config with project taking precedence', async () => {
	const fixtureDirectory = getFixture('pkg-dir');

	// Create a temporary home directory with global config
	const temporaryHome = getFixture('homedir1');

	const getConfig = await esmock(testedModulePath, {
		'is-installed-globally': true,
		'node:os': {homedir: () => temporaryHome},
	});

	const config = await getConfig(fixtureDirectory);

	// Should have project config
	assert.equal(config.source, 'package.json');
});

useLocalBinary(
	'returns config from package directory when local binary is used and `package.json` exists in package directory',
	'pkg-dir',
	'package.json',
);

useLocalBinary(
	'returns config from package directory when local binary is used and `.np-config.json` exists in package directory',
	'local1',
	'packagedir/.np-config.json',
);

useLocalBinary(
	'returns config from package directory when local binary is used and `.np-config.js` as CJS exists in package directory',
	'local2',
	'packagedir/.np-config.js',
);

useLocalBinary(
	'returns config from package directory when local binary is used and `.np-config.cjs` exists in package directory',
	'local3',
	'packagedir/.np-config.cjs',
);

useLocalBinary(
	'returns config from package directory when local binary is used and `.np-config.js` as ESM exists in package directory',
	'local4',
	'packagedir/.np-config.js',
);

useLocalBinary(
	'returns config from package directory when local binary is used and `.np-config.mjs` exists in package directory',
	'local5',
	'packagedir/.np-config.mjs',
);

test('`contents` option in config allows reading package from subdirectory', async () => {
	const fixtureDirectory = getFixture('contents-option');

	// Load config from fixture directory (simulates loading from process.cwd())
	const getConfig = await esmock(testedModulePath, {
		'is-installed-globally': false,
	});

	const config = await getConfig(fixtureDirectory);

	// Config should have contents option
	assert.equal(config.contents, 'dist');

	// Using contents from config should read package from subdirectory
	const contentsPath = path.join(fixtureDirectory, config.contents);
	const {package_, rootDirectory} = await readPackage(contentsPath);

	assert.equal(package_.name, 'from-dist');
	assert.equal(rootDirectory, contentsPath);
});

test('config values override defaults', async () => {
	const fixtureDirectory = getFixture('flag-precedence');

	const getConfig = await esmock(testedModulePath, {
		'is-installed-globally': false,
	});

	const config = await getConfig(fixtureDirectory);

	// Config should override default values
	assert.ok(!(config.tests));
	assert.ok(!(config.cleanup));
	assert.ok(!(config.publish));
});
