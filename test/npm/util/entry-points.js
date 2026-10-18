import path from 'node:path';
import fs from 'node:fs/promises';
import {createRequire} from 'node:module';
import test from 'node:test';
import assert from 'node:assert/strict';
import * as npm from '../../../source/npm/util.js';

const getFixture = name => path.resolve('test', 'fixtures', 'files', name);

test('getPackageEntryPoints - main', () => {
	assert.deepEqual(
		npm.getPackageEntryPoints({main: 'index.js'}),
		[{field: 'main', path: 'index.js'}],
	);

	assert.deepEqual(
		npm.getPackageEntryPoints({main: './dist/index.js'}),
		[{field: 'main', path: './dist/index.js'}],
	);
});

test('getPackageEntryPoints - bin as string', () => {
	assert.deepEqual(
		npm.getPackageEntryPoints({name: 'my-cli', bin: './cli.js'}),
		[{field: 'bin', path: './cli.js'}],
	);
});

test('getPackageEntryPoints - bin as object', () => {
	assert.deepEqual(
		npm.getPackageEntryPoints({bin: {foo: './bin/foo.js', bar: './bin/bar.js'}}),
		[
			{field: 'bin.foo', path: './bin/foo.js'},
			{field: 'bin.bar', path: './bin/bar.js'},
		],
	);
});

test('getPackageEntryPoints - exports as string', () => {
	assert.deepEqual(
		npm.getPackageEntryPoints({exports: './index.js'}),
		[{field: 'exports', path: './index.js'}],
	);
});

test('getPackageEntryPoints - exports with subpaths', () => {
	const entryPoints = npm.getPackageEntryPoints({
		exports: {
			'.': './index.js',
			'./foo': './foo.js',
		},
	});

	assert.deepEqual(entryPoints, [
		{field: 'exports', path: './index.js'},
		{field: 'exports', path: './foo.js'},
	]);
});

test('getPackageEntryPoints - exports with conditions', () => {
	const entryPoints = npm.getPackageEntryPoints({
		exports: {
			'.': {
				import: './index.mjs',
				require: './index.cjs',
			},
		},
	});

	assert.deepEqual(entryPoints, [
		{field: 'exports', path: './index.mjs'},
		{field: 'exports', path: './index.cjs'},
	]);
});

test('getPackageEntryPoints - exports with nested conditions', () => {
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

	assert.deepEqual(entryPoints, [
		{field: 'exports', path: './index.node.mjs'},
		{field: 'exports', path: './index.node.cjs'},
		{field: 'exports', path: './index.js'},
	]);
});

test('getPackageEntryPoints - combined main, bin, and exports', () => {
	const entryPoints = npm.getPackageEntryPoints({
		main: './index.js',
		bin: './cli.js',
		exports: {
			'.': './index.js',
			'./cli': './cli.js',
		},
	});

	assert.deepEqual(entryPoints, [
		{field: 'main', path: './index.js'},
		{field: 'bin', path: './cli.js'},
		{field: 'exports', path: './index.js'},
		{field: 'exports', path: './cli.js'},
	]);
});

test('getPackageEntryPoints - empty package', () => {
	assert.deepEqual(npm.getPackageEntryPoints({}), []);
	assert.deepEqual(npm.getPackageEntryPoints({name: 'foo', version: '1.0.0'}), []);
});

test('getPackageEntryPoints - exports with wildcard patterns are skipped', () => {
	const entryPoints = npm.getPackageEntryPoints({
		exports: {
			'.': './index.js',
			'./features/*.js': './src/features/*.js',
			'./utils/*': './src/utils/*',
		},
	});

	// Only non-wildcard exports should be included
	assert.deepEqual(entryPoints, [
		{field: 'exports', path: './index.js'},
	]);
});

test('getPackageEntryPoints - exports with null values are skipped', () => {
	const entryPoints = npm.getPackageEntryPoints({
		exports: {
			'.': './index.js',
			'./internal/*': null,
		},
	});

	assert.deepEqual(entryPoints, [
		{field: 'exports', path: './index.js'},
	]);
});

test('getPackageEntryPoints - invalid main values are skipped', () => {
	assert.deepEqual(npm.getPackageEntryPoints({main: null}), []);
	assert.deepEqual(npm.getPackageEntryPoints({main: 123}), []);
	assert.deepEqual(npm.getPackageEntryPoints({main: {}}), []);
});

test('getPackageEntryPoints - invalid bin values are skipped', () => {
	assert.deepEqual(npm.getPackageEntryPoints({bin: null}), []);
	assert.deepEqual(npm.getPackageEntryPoints({bin: 123}), []);
	assert.deepEqual(npm.getPackageEntryPoints({bin: {foo: null, bar: './bar.js'}}), [
		{field: 'bin.bar', path: './bar.js'},
	]);
});

test('getPackageEntryPoints - duplicate paths from main and exports', () => {
	const entryPoints = npm.getPackageEntryPoints({
		main: './index.js',
		exports: './index.js',
	});

	// Both are returned (deduplication happens in verifyPackageEntryPoints)
	assert.deepEqual(entryPoints, [
		{field: 'main', path: './index.js'},
		{field: 'exports', path: './index.js'},
	]);
});

test('verifyPackageEntryPoints - missing main', async () => {
	const fixtureDirectory = getFixture('missing-main');

	await assert.rejects(
		npm.verifyPackageEntryPoints({main: 'dist/index.js'}, fixtureDirectory),
		{message: /Missing entry points.*"main": dist\/index\.js/sv},
	);
});

test('verifyPackageEntryPoints - missing bin', async () => {
	const fixtureDirectory = getFixture('missing-bin');

	await assert.rejects(
		npm.verifyPackageEntryPoints({bin: './cli.js'}, fixtureDirectory),
		{message: /Missing entry points.*"bin": \.\/cli\.js/sv},
	);
});

test('verifyPackageEntryPoints - valid entry points', async () => {
	const fixtureDirectory = getFixture('one-file');

	await assert.doesNotReject(npm.verifyPackageEntryPoints({main: 'index.js'}, fixtureDirectory));
});

for (const [main, filename] of [
	['index', 'index.js'],
	['data', 'data.json'],
	['dist', 'dist/index.js'],
	['dist/', 'dist/index.js'],
]) {
	test(`verifyPackageEntryPoints - resolves main ${main} to ${filename}`, async t => {
		await fs.mkdir('.ai-temporary', {recursive: true});
		const temporaryDirectory = await fs.mkdtemp(path.resolve('.ai-temporary', 'main-entry-point-'));
		t.after(() => fs.rm(temporaryDirectory, {recursive: true}));
		const package_ = {
			name: 'main-entry-point', version: '1.0.0', main, files: [filename],
		};
		await fs.writeFile(path.join(temporaryDirectory, 'package.json'), JSON.stringify(package_));
		await fs.mkdir(path.dirname(path.join(temporaryDirectory, filename)), {recursive: true});
		await fs.writeFile(path.join(temporaryDirectory, filename), '');

		// Match the package entry point Node actually resolves, rather than requiring an exact filename in main.
		assert.equal(createRequire(import.meta.url).resolve(temporaryDirectory), path.join(temporaryDirectory, filename));
		await assert.doesNotReject(npm.verifyPackageEntryPoints(package_, temporaryDirectory));
	});
}

test('verifyPackageEntryPoints - bin and exports do not use main resolution', async () => {
	const fixtureDirectory = getFixture('one-file');

	await assert.rejects(npm.verifyPackageEntryPoints({bin: 'index'}, fixtureDirectory), {message: /"bin": index/v});
	await assert.rejects(npm.verifyPackageEntryPoints({exports: './index'}, fixtureDirectory), {message: /"exports": \.\/index/v});
});

test('verifyPackageEntryPoints - skipped when prepack script may generate files', async () => {
	const fixtureDirectory = getFixture('prepack-generated-entry-point');

	await assert.doesNotReject(npm.verifyPackageEntryPoints({
		main: 'dist/index.js',
		scripts: {
			prepack: 'build',
		},
	}, fixtureDirectory));
});

test('verifyPackageEntryPoints - throws when ignore-scripts prevents the build script from running', async () => {
	const fixtureDirectory = getFixture('prepack-generated-entry-point');

	await assert.rejects(
		npm.verifyPackageEntryPoints({
			main: 'dist/index.js',
			scripts: {
				prepack: 'build',
			},
		}, fixtureDirectory, {ignoreScripts: true}),
		{message: /ignore-scripts.*false.*\.npmrc/sv},
	);
});

test('verifyPackageEntryPoints - throws generic error when ignore-scripts is enabled but there is no lifecycle script', async () => {
	const fixtureDirectory = getFixture('missing-main');

	await assert.rejects(
		npm.verifyPackageEntryPoints({main: 'dist/index.js'}, fixtureDirectory, {ignoreScripts: true}),
		{message: /Ensure these files exist/v},
	);
});
