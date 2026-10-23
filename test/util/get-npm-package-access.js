import assert from 'node:assert/strict';
import {_createFixture} from '../_helpers/stub-execa.js';

/**
@type {ReturnType<typeof createFixture<typeof import('../../source/util.js')>>}
*/
const createFixture = _createFixture('../../source/util.js', import.meta.url);

createFixture('main', [{
	command: 'npm access get status @my/pkg --json',
	stdout: '{"@my/pkg": "public"}',
}], async ({
	testedModule: {getNpmPackageAccess},
}) => {
	assert.equal(
		await getNpmPackageAccess({name: '@my/pkg'}),
		'public',
	);
});

createFixture('with publishConfig.registry', [{
	command: 'npm access get status @my/pkg --json --registry https://registry.npmjs.org/',
	stdout: '{"@my/pkg": "public"}',
}], async ({
	testedModule: {getNpmPackageAccess},
}) => {
	assert.equal(
		await getNpmPackageAccess({
			name: '@my/pkg',
			publishConfig: {
				registry: 'https://registry.npmjs.org/',
			},
		}),
		'public',
	);
});

createFixture('with external registry', [{
	command: 'npm access get status @my/pkg --json --registry http://my-internal-registry.local',
	stdout: '{"@my/pkg": "private"}',
}], async ({
	testedModule: {getNpmPackageAccess},
}) => {
	assert.equal(
		await getNpmPackageAccess({
			name: '@my/pkg',
			publishConfig: {
				registry: 'http://my-internal-registry.local',
			},
		}),
		'private',
	);
});

createFixture('timeout', [{
	command: 'npm access get status @my/pkg --json',
	exitCode: 1,
	timedOut: true,
}], async ({
	testedModule: {getNpmPackageAccess},
}) => {
	await assert.rejects(
		getNpmPackageAccess({name: '@my/pkg'}),
		{message: 'Connection to npm registry timed out', isPresentable: true},
	);
});
