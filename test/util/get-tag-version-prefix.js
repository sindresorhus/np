import test from 'node:test';
import assert from 'node:assert/strict';
import {_createFixture} from '../_helpers/stub-execa.js';
import {getTagVersionPrefix as originalGetTagVersionPrefix} from '../../source/util.js';
import {npmConfig, yarnConfig, pnpmConfig} from '../../source/package-manager/configs.js';

/**
@type {ReturnType<typeof createFixture<typeof import('../../source/util.js')>>}
*/
const createFixture = _createFixture('../../source/util.js', import.meta.url);

createFixture('returns tag prefix - npm', [{
	command: 'npm config get tag-version-prefix --workspaces=false',
	stdout: 'ver',
}], async ({
	testedModule: {getTagVersionPrefix},
}) => {
	assert.equal(
		await getTagVersionPrefix(npmConfig),
		'ver',
	);
});

createFixture('returns preId postfix - yarn', [{
	command: 'yarn config get version-tag-prefix',
	stdout: 'ver',
}], async ({
	testedModule: {getTagVersionPrefix},
}) => {
	assert.equal(
		await getTagVersionPrefix(yarnConfig),
		'ver',
	);
});

createFixture('defaults to "v" when command fails', [{
	command: 'npm config get tag-version-prefix --workspaces=false',
	exitCode: 1,
}], async ({
	testedModule: {getTagVersionPrefix},
}) => {
	assert.equal(
		await getTagVersionPrefix(npmConfig),
		'v',
	);
});

createFixture('returns tag prefix - pnpm (uses npm config)', [{
	command: 'npm config get tag-version-prefix --workspaces=false',
	stdout: 'v',
}], async ({
	testedModule: {getTagVersionPrefix},
}) => {
	assert.equal(
		await getTagVersionPrefix(pnpmConfig),
		'v',
	);
});

createFixture('returns custom tag prefix - pnpm', [{
	command: 'npm config get tag-version-prefix --workspaces=false',
	stdout: 'ver',
}], async ({
	testedModule: {getTagVersionPrefix},
}) => {
	assert.equal(
		await getTagVersionPrefix(pnpmConfig),
		'ver',
	);
});

createFixture('returns empty string tag prefix - pnpm', [{
	command: 'npm config get tag-version-prefix --workspaces=false',
	stdout: '',
}], async ({
	testedModule: {getTagVersionPrefix},
}) => {
	assert.equal(
		await getTagVersionPrefix(pnpmConfig),
		'',
	);
});

createFixture('pnpm defaults to "v" when npm config fails', [{
	command: 'npm config get tag-version-prefix --workspaces=false',
	exitCode: 1,
}], async ({
	testedModule: {getTagVersionPrefix},
}) => {
	assert.equal(
		await getTagVersionPrefix(pnpmConfig),
		'v',
	);
});

test('no options passed', async () => {
	await assert.rejects(
		originalGetTagVersionPrefix(),
		{message: 'Config is missing key `tagVersionPrefixCommand`'},
	);

	await assert.rejects(
		originalGetTagVersionPrefix({}),
		{message: 'Config is missing key `tagVersionPrefixCommand`'},
	);
});
