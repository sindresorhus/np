import test from 'ava';
import {updatePackage} from 'write-package';
import {readPackage} from 'read-pkg';
import {_createFixture} from '../_helpers/integration-test.js';

/** @type {ReturnType<typeof _createFixture<import('../../source/util.js')>>} */
const createFixture = _createFixture('../../source/util.js');

test('reports new dependencies since last release', createFixture, async ({$$, temporaryDir}) => {
	await updatePackage(temporaryDir, {dependencies: {'dog-names': '^2.1.0'}});
	await $$`git add .`;
	await $$`git commit -m "added"`;
	await $$`git tag v0.0.0`;
	await updatePackage(temporaryDir, {dependencies: {'cat-names': '^3.1.0'}});
}, async ({t, testedModule: {getNewDependencies}, temporaryDir}) => {
	const pkg = await readPackage({cwd: temporaryDir});

	t.deepEqual(
		await getNewDependencies(pkg, temporaryDir),
		['cat-names'],
	);
});

test('handles first time publish (no package.json in last release)', createFixture, async ({temporaryDir}) => {
	await updatePackage(temporaryDir, {dependencies: {'cat-names': '^3.1.0'}});
}, async ({t, testedModule: {getNewDependencies}, temporaryDir}) => {
	const pkg = await readPackage({cwd: temporaryDir});

	t.deepEqual(
		await getNewDependencies(pkg, temporaryDir),
		['cat-names'],
	);
});

test('handles first time publish (no package.json in last release) - no deps', createFixture, async ({temporaryDir}) => {
	await updatePackage(temporaryDir, {name: '@np/foo'});
}, async ({t, testedModule: {getNewDependencies}, temporaryDir}) => {
	const pkg = await readPackage({cwd: temporaryDir});

	t.deepEqual(
		await getNewDependencies(pkg, temporaryDir),
		[],
	);
});
