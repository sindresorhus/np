import {fileURLToPath} from 'node:url';
import path from 'node:path';
import test from 'ava';
import esmock from 'esmock';
import {temporaryDirectory} from 'tempy';
import {readPackage, npPackage, npRootDirectory} from '../../source/util.js';

const rootDirectory = fileURLToPath(new URL('../..', import.meta.url)).slice(0, -1);

test('without packagePath returns np package.json', async t => {
	const {package_, rootDirectory: packageDirectory} = await readPackage();

	t.is(package_.name, 'np');
	t.is(packageDirectory, rootDirectory);
});

test('with packagePath', async t => {
	const fixtureDirectory = path.resolve(rootDirectory, 'test/fixtures/files/one-file');
	const {package_, rootDirectory: packageDirectory} = await readPackage(fixtureDirectory);

	t.is(package_.name, 'foo');
	t.is(packageDirectory, fixtureDirectory);
});

test('no package.json', async t => {
	await t.throwsAsync(
		readPackage(temporaryDirectory()),
		{message: 'No `package.json` found. Make sure the current directory is a valid package.'},
	);
});

test('npPackage', t => {
	t.is(npPackage.name, 'np');
});

test('npRootDirectory', t => {
	t.is(npRootDirectory, rootDirectory);
});

test('npRootDirectory is correct when process.cwd is different', async t => {
	const cwd = temporaryDirectory();

	/** @type {import('../../source/util.js')} */
	const util = await esmock('../../source/util.js', {}, {
		'node:process': {cwd},
	});

	t.is(util.npRootDirectory, rootDirectory);
});
