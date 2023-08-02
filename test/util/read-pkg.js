import {fileURLToPath} from 'node:url';
import path from 'node:path';
import test from 'ava';
import esmock from 'esmock';
import {temporaryDirectory} from 'tempy';
import {readPkg, npPkg, npRootDir} from '../../source/util.js';

const rootDir = fileURLToPath(new URL('../..', import.meta.url)).slice(0, -1);

test('without packagePath returns np package.json', async t => {
	const {pkg, rootDir: pkgDir} = await readPkg();

	t.is(pkg.name, 'np');
	t.is(pkgDir, rootDir);
});

test('with packagePath', async t => {
	const fixtureDir = path.resolve(rootDir, 'test/fixtures/files/one-file');
	const {pkg, rootDir: pkgDir} = await readPkg(fixtureDir);

	t.is(pkg.name, 'foo');
	t.is(pkgDir, fixtureDir);
});

test('no package.json', async t => {
	await t.throwsAsync(
		readPkg(temporaryDirectory()),
		{message: 'No `package.json` found. Make sure the current directory is a valid package.'},
	);
});

test('npPkg', t => {
	t.is(npPkg.name, 'np');
});

test('npRootDir', t => {
	t.is(npRootDir, rootDir);
});

test('npRootDir is correct when process.cwd is different', async t => {
	const temporaryDir = temporaryDirectory();

	/** @type {import('../../source/util.js')} */
	const util = await esmock('../../source/util.js', {}, {
		'node:process': {cwd: temporaryDir},
	});

	t.is(util.npRootDir, rootDir);
});
