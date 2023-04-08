import {fileURLToPath} from 'node:url';
import path from 'node:path';
import test from 'ava';
import {temporaryDirectory} from 'tempy';
import stripAnsi from 'strip-ansi';
import * as util from '../../source/util.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '../..');

test('util.readPkg - without packagePath', async t => {
	const {pkg, rootDir: pkgDir} = await util.readPkg();

	t.is(pkg.name, 'np');
	t.is(pkgDir, rootDir);
});

test('util.readPkg - with packagePath', async t => {
	const fixtureDir = path.resolve(rootDir, 'test/fixtures/files/one-file');
	const {pkg, rootDir: pkgDir} = await util.readPkg(fixtureDir);

	t.is(pkg.name, 'foo');
	t.is(pkgDir, fixtureDir);
});

test('util.readPkg - no package.json', async t => {
	await t.throwsAsync(
		util.readPkg(temporaryDirectory()),
		{message: 'No `package.json` found. Make sure the current directory is a valid package.'},
	);
});

const testJoinList = test.macro((t, list, expectations) => {
	const output = util.joinList(list);
	t.is(stripAnsi(output), expectations);
});

test('util.joinList - one item', testJoinList, ['foo'], '- foo');

test('util.joinList - two items', testJoinList, ['foo', 'bar'], '- foo\n- bar');

test('util.joinList - multiple items', testJoinList, ['foo', 'bar', 'baz'], '- foo\n- bar\n- baz');
