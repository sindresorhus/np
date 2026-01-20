import test from 'ava';
import {_createFixture} from '../_helpers/stub-execa.js';

/** @type {ReturnType<typeof _createFixture<import('../../source/util.js')>>} */
const createFixture = _createFixture('../../source/util.js', import.meta.url);

test('main', createFixture, [{
	command: 'npm access get status @my/pkg --json',
	stdout: '{"@my/pkg": "public"}',
}], async ({t, testedModule: {getNpmPackageAccess}}) => {
	t.is(
		await getNpmPackageAccess({name: '@my/pkg'}),
		'public',
	);
});

test('with publishConfig.registry', createFixture, [{
	command: 'npm access get status @my/pkg --json --registry https://registry.npmjs.org/',
	stdout: '{"@my/pkg": "public"}',
}], async ({t, testedModule: {getNpmPackageAccess}}) => {
	t.is(
		await getNpmPackageAccess({
			name: '@my/pkg',
			publishConfig: {
				registry: 'https://registry.npmjs.org/',
			},
		}),
		'public',
	);
});

test('with external registry', createFixture, [{
	command: 'npm access get status @my/pkg --json --registry http://my-internal-registry.local',
	stdout: '{"@my/pkg": "private"}',
}], async ({t, testedModule: {getNpmPackageAccess}}) => {
	t.is(
		await getNpmPackageAccess({
			name: '@my/pkg',
			publishConfig: {
				registry: 'http://my-internal-registry.local',
			},
		}),
		'private',
	);
});
