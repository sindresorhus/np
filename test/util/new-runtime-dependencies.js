import assert from 'node:assert/strict';
import {updatePackage} from 'write-package';
import {readPackage} from 'read-pkg';
import {_createFixture} from '../_helpers/integration-test.js';

const createFixture = _createFixture('../../source/util.js');

for (const hasPreviousRelease of [false, true]) {
	createFixture(`reports new optional and peer dependencies ${hasPreviousRelease ? 'since the previous release' : 'on the first release'}`, async ({$$, temporaryDirectory}) => {
		await updatePackage(temporaryDirectory, {name: 'runtime-dependencies-fixture', version: '1.0.0'});
		if (hasPreviousRelease) {
			await $$`git add .`;
			await $$`git commit -m initial-release`;
			await $$`git tag v1.0.0`;
		}

		await updatePackage(temporaryDirectory, {
			dependencies: {'direct-dependency': '^1.0.0'},
			optionalDependencies: {'optional-dependency': '^1.0.0'},
			peerDependencies: {'peer-dependency': '^1.0.0'},
			devDependencies: {'development-dependency': '^1.0.0'},
		});
	}, async ({testedModule: {getNewDependencies}, temporaryDirectory}) => {
		const package_ = await readPackage({cwd: temporaryDirectory});
		assert.deepEqual(await getNewDependencies(package_, temporaryDirectory), ['direct-dependency', 'optional-dependency', 'peer-dependency']);
	});
}

createFixture('does not report existing dependencies moved between runtime dependency fields', async ({$$, temporaryDirectory}) => {
	await updatePackage(temporaryDirectory, {
		name: 'runtime-dependencies-fixture',
		version: '1.0.0',
		dependencies: {'direct-to-optional': '^1.0.0'},
		optionalDependencies: {'optional-to-peer': '^1.0.0'},
		peerDependencies: {'peer-to-direct': '^1.0.0'},
	});
	await $$`git add .`;
	await $$`git commit -m initial-release`;
	await $$`git tag v1.0.0`;
	await updatePackage(temporaryDirectory, {
		dependencies: {'peer-to-direct': '^1.0.0'},
		optionalDependencies: {'direct-to-optional': '^1.0.0'},
		peerDependencies: {'optional-to-peer': '^1.0.0'},
		devDependencies: {'development-dependency': '^1.0.0'},
	});
}, async ({testedModule: {getNewDependencies}, temporaryDirectory}) => {
	const package_ = await readPackage({cwd: temporaryDirectory});
	assert.deepEqual(await getNewDependencies(package_, temporaryDirectory), []);
});

createFixture('reports a dependency only once when declared in multiple runtime fields', async ({temporaryDirectory}) => {
	await updatePackage(temporaryDirectory, {
		name: 'runtime-dependencies-fixture',
		dependencies: {'shared-dependency': '^1.0.0'},
		optionalDependencies: {'shared-dependency': '^1.0.0'},
		peerDependencies: {'shared-dependency': '^1.0.0'},
	});
}, async ({testedModule: {getNewDependencies}, temporaryDirectory}) => {
	const package_ = await readPackage({cwd: temporaryDirectory});
	assert.deepEqual(await getNewDependencies(package_, temporaryDirectory), ['shared-dependency']);
});
