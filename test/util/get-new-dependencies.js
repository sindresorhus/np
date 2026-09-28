import assert from 'node:assert/strict';
import {updatePackage} from 'write-package';
import {readPackage} from 'read-pkg';
import {_createFixture} from '../_helpers/integration-test.js';

/**
@type {ReturnType<typeof createFixture<typeof import('../../source/util.js')>>}
*/
const createFixture = _createFixture('../../source/util.js');

createFixture(
	'reports new dependencies since last release',
	async ({$$, temporaryDirectory}) => {
		await updatePackage(temporaryDirectory, {dependencies: {'dog-names': '^2.1.0'}});
		await $$`git add .`;
		await $$`git commit -m "added"`;
		await $$`git tag v0.0.0`;
		await updatePackage(temporaryDirectory, {dependencies: {'cat-names': '^3.1.0'}});
	},
	async ({
		testedModule: {getNewDependencies},
		temporaryDirectory,
	}) => {
		const package_ = await readPackage({cwd: temporaryDirectory});

		assert.deepEqual(
			await getNewDependencies(package_, temporaryDirectory),
			['cat-names'],
		);
	},
);

createFixture(
	'reports no new dependencies when the package removes all dependencies',
	async ({$$, temporaryDirectory}) => {
		await updatePackage(temporaryDirectory, {dependencies: {'dog-names': '^2.1.0'}});
		await $$`git add .`;
		await $$`git commit -m "added"`;
		await $$`git tag v0.0.0`;
		await updatePackage(temporaryDirectory, {dependencies: {}});
	},
	async ({
		testedModule: {getNewDependencies},
		temporaryDirectory,
	}) => {
		const package_ = await readPackage({cwd: temporaryDirectory});

		assert.deepEqual(
			await getNewDependencies(package_, temporaryDirectory),
			[],
		);
	},
);

createFixture(
	'handles first time publish (no package.json in last release)',
	async ({temporaryDirectory}) => {
		await updatePackage(temporaryDirectory, {dependencies: {'cat-names': '^3.1.0'}});
	},
	async ({
		testedModule: {getNewDependencies},
		temporaryDirectory,
	}) => {
		const package_ = await readPackage({cwd: temporaryDirectory});

		assert.deepEqual(
			await getNewDependencies(package_, temporaryDirectory),
			['cat-names'],
		);
	},
);

createFixture(
	'handles first time publish (no package.json in last release) - no deps',
	async ({temporaryDirectory}) => {
		await updatePackage(temporaryDirectory, {name: '@np/foo'});
	},
	async ({
		testedModule: {getNewDependencies},
		temporaryDirectory,
	}) => {
		const package_ = await readPackage({cwd: temporaryDirectory});

		assert.deepEqual(
			await getNewDependencies(package_, temporaryDirectory),
			[],
		);
	},
);
