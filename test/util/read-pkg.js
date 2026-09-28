import {fileURLToPath} from 'node:url';
import path from 'node:path';
import test from 'node:test';
import assert from 'node:assert/strict';
import esmock from 'esmock';
import {temporaryDirectory} from 'tempy';
import {readPackage, npPackage, npRootDirectory} from '../../source/util.js';

const rootDirectory = fileURLToPath(new URL('../..', import.meta.url)).slice(0, -1);

test('without packagePath returns np package.json', async () => {
	const {package_, rootDirectory: packageDirectory} = await readPackage();

	assert.equal(package_.name, 'np');
	assert.equal(packageDirectory, rootDirectory);
});

test('with packagePath', async () => {
	const fixtureDirectory = path.resolve(rootDirectory, 'test/fixtures/files/one-file');
	const {package_, rootDirectory: packageDirectory} = await readPackage(fixtureDirectory);

	assert.equal(package_.name, 'foo');
	assert.equal(packageDirectory, fixtureDirectory);
});

test('no package.json', async () => {
	await assert.rejects(
		readPackage(temporaryDirectory()),
		{message: 'No `package.json` found. Make sure the current directory is a valid package.'},
	);
});

test('npPackage', () => {
	assert.equal(npPackage.name, 'np');
});

test('npRootDirectory', () => {
	assert.equal(npRootDirectory, rootDirectory);
});

test('npRootDirectory is correct when process.cwd is different', async () => {
	const cwd = temporaryDirectory();

	/**
	@type {import('../../source/util.js')}
	*/
	const util = await esmock('../../source/util.js', {}, {
		'node:process': {cwd},
	});

	assert.equal(util.npRootDirectory, rootDirectory);
});
