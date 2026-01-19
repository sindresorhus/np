import test from 'ava';
import {updatePackage} from 'write-package';
import {readPackage} from 'read-pkg';
import {_createFixture} from '../_helpers/integration-test.js';

/** @type {ReturnType<typeof _createFixture<import('../../source/util.js')>>} */
const createFixture = _createFixture('../../source/util.js');

test('reports new dependencies since last release', createFixture, async ({$$, temporaryDirectory}) => {
	await updatePackage(temporaryDirectory, {dependencies: {'dog-names': '^2.1.0'}});
	await $$`git add .`;
	await $$`git commit -m "added"`;
	await $$`git tag v0.0.0`;
	await updatePackage(temporaryDirectory, {dependencies: {'cat-names': '^3.1.0'}});
}, async ({t, testedModule: {getNewDependencies}, temporaryDirectory}) => {
	const package_ = await readPackage({cwd: temporaryDirectory});

	t.deepEqual(
		await getNewDependencies(package_, temporaryDirectory),
		['cat-names'],
	);
});

test('handles first time publish (no package.json in last release)', createFixture, async ({temporaryDirectory}) => {
	await updatePackage(temporaryDirectory, {dependencies: {'cat-names': '^3.1.0'}});
}, async ({t, testedModule: {getNewDependencies}, temporaryDirectory}) => {
	const package_ = await readPackage({cwd: temporaryDirectory});

	t.deepEqual(
		await getNewDependencies(package_, temporaryDirectory),
		['cat-names'],
	);
});

test('handles first time publish (no package.json in last release) - no deps', createFixture, async ({temporaryDirectory}) => {
	await updatePackage(temporaryDirectory, {name: '@np/foo'});
}, async ({t, testedModule: {getNewDependencies}, temporaryDirectory}) => {
	const package_ = await readPackage({cwd: temporaryDirectory});

	t.deepEqual(
		await getNewDependencies(package_, temporaryDirectory),
		[],
	);
});
