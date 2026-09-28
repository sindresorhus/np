import fs from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import assert from 'node:assert/strict';
import {writePackage} from 'write-package';
import {getFilesToBePacked} from '../../../source/npm/util.js';
import {createIntegrationTest} from '../../_helpers/integration-test.js';
import {runIfExists} from '../../_helpers/util.js';

const getFixture = name => path.resolve('test', 'fixtures', 'files', name);

const verifyPackedFiles = (title, fixture, expectedFiles, {before, after} = {}) => {
	test(title, async t => {
		const fixtureDirectory = getFixture(fixture);

		await runIfExists(before, fixtureDirectory);
		t.after(async () => runIfExists(after, fixtureDirectory));

		const files = await getFilesToBePacked(fixtureDirectory);
		assert.deepEqual(files.toSorted((a, b) => a.localeCompare(b)), [...expectedFiles, 'package.json'].toSorted((a, b) => a.localeCompare(b)), 'Files different from expectations!');
	});
};

verifyPackedFiles('package.json files field - one file', 'one-file', [
	'index.js',
]);

verifyPackedFiles('package.json files field - source dir', 'source-dir', [
	'source/foo.js',
	'source/bar.js',
]);

verifyPackedFiles(
	'package.json files field - source and dist dirs',
	'source-and-dist-dir',
	[
		'source/foo.js',
		'source/bar.js',
	],
);

verifyPackedFiles('package.json files field - leading slash', 'files-slash', [
	'index.js',
]);

verifyPackedFiles(
	'package.json files field - has readme and license',
	'has-readme-and-license',
	[
		'readme.md',
		'license.md',
		'index.js',
	],
);

verifyPackedFiles('npmignore', 'npmignore', [
	'readme.md',
	'index.js',
	'index.d.ts',
]);

verifyPackedFiles('package.json files field and npmignore', 'files-and-npmignore', [
	'readme.md',
	'source/foo.js',
	'source/bar.js',
	'source/index.d.ts',
]);

verifyPackedFiles('package.json files field and gitignore', 'gitignore', [
	'readme.md',
	'dist/index.js',
]);

verifyPackedFiles('npmignore and gitignore', 'npmignore-and-gitignore', [
	'readme.md',
	'dist/index.js',
]);

verifyPackedFiles('package.json main field not in files field', 'main', [
	'foo.js',
	'bar.js',
]);

verifyPackedFiles('doesn\'t show files in .github', 'dot-github', [
	'index.js',
]);

verifyPackedFiles('handles prepare script output (e.g., Husky)', 'prepare-script', [
	'index.js',
]);

verifyPackedFiles('ignores failing prepack script', 'failing-prepack-script', [
	'index.js',
]);

const verifyDevEnginesPackageManager = (title, packageManager) => {
	test(title, async t => {
		await createIntegrationTest(t, async ({temporaryDirectory}) => {
			await writePackage(temporaryDirectory, {
				name: 'fixture',
				version: '1.0.0',
				files: ['index.js'],
				devEngines: {
					packageManager,
				},
			});
			await fs.writeFile(path.join(temporaryDirectory, 'index.js'), '');

			// `npm pack` must not block inspection based on the package's development manager.
			const files = await getFilesToBePacked(temporaryDirectory);
			assert.deepEqual(files.toSorted((left, right) => left.localeCompare(right)), ['index.js', 'package.json']);
		});
	});
};

verifyDevEnginesPackageManager('works when the package requires a different package manager', {
	name: 'pnpm',
	version: '11.15.1',
	onFail: 'download',
});

verifyDevEnginesPackageManager('works when the package requires a different npm version', {
	name: 'npm',
	version: '<0.0.0',
	onFail: 'error',
});

verifyDevEnginesPackageManager('works when the package lists multiple other package managers', [
	{
		name: 'pnpm',
		version: '11.15.1',
		onFail: 'error',
	},
	{
		name: 'yarn',
		version: '4.0.0',
		onFail: 'error',
	},
]);
