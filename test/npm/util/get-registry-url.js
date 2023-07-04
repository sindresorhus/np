import test from 'ava';
import {_createFixture} from '../../_helpers/stub-execa.js';

/** @type {ReturnType<typeof _createFixture<import('../../../source/npm/util.js')>>} */
const createFixture = _createFixture('../../../source/npm/util.js', import.meta.url);

test('npm', createFixture, [{
	command: 'npm config get registry',
	stdout: 'https://registry.npmjs.org/',
}], async ({t, testedModule: npm}) => {
	t.is(
		await npm.getRegistryUrl('npm', {}),
		'https://registry.npmjs.org/',
	);
});

test('yarn', createFixture, [{
	command: 'yarn config get registry',
	stdout: 'https://registry.yarnpkg.com',
}], async ({t, testedModule: npm}) => {
	t.is(
		await npm.getRegistryUrl('yarn', {}),
		'https://registry.yarnpkg.com',
	);
});

test('external', createFixture, [{
	command: 'npm config get registry --registry http://my-internal-registry.local',
	stdout: 'http://my-internal-registry.local',
}], async ({t, testedModule: npm}) => {
	t.is(
		await npm.getRegistryUrl('npm', {
			publishConfig: {
				registry: 'http://my-internal-registry.local',
			},
		}),
		'http://my-internal-registry.local',
	);
});
