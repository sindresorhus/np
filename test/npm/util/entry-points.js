import path from 'node:path';
import test from 'ava';
import * as npm from '../../../source/npm/util.js';

const getFixture = name => path.resolve('test', 'fixtures', 'files', name);

test('getPackageEntryPoints - main', t => {
	t.deepEqual(
		npm.getPackageEntryPoints({main: 'index.js'}),
		[{field: 'main', path: 'index.js'}],
	);

	t.deepEqual(
		npm.getPackageEntryPoints({main: './dist/index.js'}),
		[{field: 'main', path: './dist/index.js'}],
	);
});

test('getPackageEntryPoints - bin as string', t => {
	t.deepEqual(
		npm.getPackageEntryPoints({name: 'my-cli', bin: './cli.js'}),
		[{field: 'bin', path: './cli.js'}],
	);
});

test('getPackageEntryPoints - bin as object', t => {
	t.deepEqual(
		npm.getPackageEntryPoints({bin: {foo: './bin/foo.js', bar: './bin/bar.js'}}),
		[
			{field: 'bin.foo', path: './bin/foo.js'},
			{field: 'bin.bar', path: './bin/bar.js'},
		],
	);
});

test('getPackageEntryPoints - exports as string', t => {
	t.deepEqual(
		npm.getPackageEntryPoints({exports: './index.js'}),
		[{field: 'exports', path: './index.js'}],
	);
});

test('getPackageEntryPoints - exports with subpaths', t => {
	const entryPoints = npm.getPackageEntryPoints({
		exports: {
			'.': './index.js',
			'./foo': './foo.js',
		},
	});

	t.deepEqual(entryPoints, [
		{field: 'exports', path: './index.js'},
		{field: 'exports', path: './foo.js'},
	]);
});

test('getPackageEntryPoints - exports with conditions', t => {
	const entryPoints = npm.getPackageEntryPoints({
		exports: {
			'.': {
				import: './index.mjs',
				require: './index.cjs',
			},
		},
	});

	t.deepEqual(entryPoints, [
		{field: 'exports', path: './index.mjs'},
		{field: 'exports', path: './index.cjs'},
	]);
});

test('getPackageEntryPoints - exports with nested conditions', t => {
	const entryPoints = npm.getPackageEntryPoints({
		exports: {
			'.': {
				node: {
					import: './index.node.mjs',
					require: './index.node.cjs',
				},
				default: './index.js',
			},
		},
	});

	t.deepEqual(entryPoints, [
		{field: 'exports', path: './index.node.mjs'},
		{field: 'exports', path: './index.node.cjs'},
		{field: 'exports', path: './index.js'},
	]);
});

test('getPackageEntryPoints - combined main, bin, and exports', t => {
	const entryPoints = npm.getPackageEntryPoints({
		main: './index.js',
		bin: './cli.js',
		exports: {
			'.': './index.js',
			'./cli': './cli.js',
		},
	});

	t.deepEqual(entryPoints, [
		{field: 'main', path: './index.js'},
		{field: 'bin', path: './cli.js'},
		{field: 'exports', path: './index.js'},
		{field: 'exports', path: './cli.js'},
	]);
});

test('getPackageEntryPoints - empty package', t => {
	t.deepEqual(npm.getPackageEntryPoints({}), []);
	t.deepEqual(npm.getPackageEntryPoints({name: 'foo', version: '1.0.0'}), []);
});

test('getPackageEntryPoints - exports with wildcard patterns are skipped', t => {
	const entryPoints = npm.getPackageEntryPoints({
		exports: {
			'.': './index.js',
			'./features/*.js': './src/features/*.js',
			'./utils/*': './src/utils/*',
		},
	});

	// Only non-wildcard exports should be included
	t.deepEqual(entryPoints, [
		{field: 'exports', path: './index.js'},
	]);
});

test('getPackageEntryPoints - exports with null values are skipped', t => {
	const entryPoints = npm.getPackageEntryPoints({
		exports: {
			'.': './index.js',
			'./internal/*': null,
		},
	});

	t.deepEqual(entryPoints, [
		{field: 'exports', path: './index.js'},
	]);
});

test('getPackageEntryPoints - invalid main values are skipped', t => {
	t.deepEqual(npm.getPackageEntryPoints({main: null}), []);
	t.deepEqual(npm.getPackageEntryPoints({main: 123}), []);
	t.deepEqual(npm.getPackageEntryPoints({main: {}}), []);
});

test('getPackageEntryPoints - invalid bin values are skipped', t => {
	t.deepEqual(npm.getPackageEntryPoints({bin: null}), []);
	t.deepEqual(npm.getPackageEntryPoints({bin: 123}), []);
	t.deepEqual(npm.getPackageEntryPoints({bin: {foo: null, bar: './bar.js'}}), [
		{field: 'bin.bar', path: './bar.js'},
	]);
});

test('getPackageEntryPoints - duplicate paths from main and exports', t => {
	const entryPoints = npm.getPackageEntryPoints({
		main: './index.js',
		exports: './index.js',
	});

	// Both are returned (deduplication happens in verifyPackageEntryPoints)
	t.deepEqual(entryPoints, [
		{field: 'main', path: './index.js'},
		{field: 'exports', path: './index.js'},
	]);
});

test('verifyPackageEntryPoints - missing main', async t => {
	const fixtureDirectory = getFixture('missing-main');

	await t.throwsAsync(
		npm.verifyPackageEntryPoints({main: 'dist/index.js'}, fixtureDirectory),
		{message: /Missing entry points.*"main": dist\/index\.js/s},
	);
});

test('verifyPackageEntryPoints - missing bin', async t => {
	const fixtureDirectory = getFixture('missing-bin');

	await t.throwsAsync(
		npm.verifyPackageEntryPoints({bin: './cli.js'}, fixtureDirectory),
		{message: /Missing entry points.*"bin": \.\/cli\.js/s},
	);
});

test('verifyPackageEntryPoints - valid entry points', async t => {
	const fixtureDirectory = getFixture('one-file');

	await t.notThrowsAsync(npm.verifyPackageEntryPoints({main: 'index.js'}, fixtureDirectory));
});
