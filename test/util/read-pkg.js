import {fileURLToPath} from 'node:url';
import path from 'node:path';
import test from 'ava';
import {temporaryDirectory} from 'tempy';
import {readPkg, npPkg, npRootDir} from '../../source/util.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '../..');

test('without packagePath', async t => {
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
