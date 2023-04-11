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

test('util.npPkg', t => {
	t.is(util.npPkg.name, 'np');
});

test('util.npRootDir', t => {
	t.is(util.npRootDir, rootDir);
});

const testJoinList = test.macro((t, list, expectations) => {
	const output = util.joinList(list);
	t.is(stripAnsi(output), expectations);
});

test('util.joinList - one item', testJoinList, ['foo'], '- foo');

test('util.joinList - two items', testJoinList, ['foo', 'bar'], '- foo\n- bar');

test('util.joinList - multiple items', testJoinList, ['foo', 'bar', 'baz'], '- foo\n- bar\n- baz');

const testEngineRanges = test.macro((t, engine, {above, below}) => {
	const range = util.npPkg.engines[engine];

	t.notThrows(
		() => util.validateEngineVersionSatisfies(engine, above), // One above minimum
	);

	t.throws(
		() => util.validateEngineVersionSatisfies(engine, below), // One below minimum
		{message: `\`np\` requires ${engine} ${range}`},
	);
});

test('util.validateEngineVersionSatisfies - node', testEngineRanges, 'node', {above: '16.7.0', below: '16.5.0'});

test('util.validateEngineVersionSatisfies - npm', testEngineRanges, 'npm', {above: '7.20.0', below: '7.18.0'});

test('util.validateEngineVersionSatisfies - git', testEngineRanges, 'git', {above: '2.12.0', below: '2.10.0'});

test('util.validateEngineVersionSatisfies - yarn', testEngineRanges, 'yarn', {above: '1.8.0', below: '1.6.0'});

