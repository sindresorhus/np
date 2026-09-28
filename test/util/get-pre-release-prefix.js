import process from 'node:process';
import test from 'node:test';
import assert from 'node:assert/strict';
import {_createFixture} from '../_helpers/stub-execa.js';
import {getPreReleasePrefix as originalGetPreReleasePrefix} from '../../source/util.js';

/**
@type {ReturnType<typeof createFixture<typeof import('../../source/util.js')>>}
*/
const createFixture = _createFixture('../../source/util.js', import.meta.url);

createFixture('returns preid postfix if set - npm', [{
	command: 'npm config get preid',
	stdout: 'pre',
}], async ({
	testedModule: {getPreReleasePrefix},
}) => {
	assert.equal(
		await getPreReleasePrefix({cli: 'npm'}),
		'pre',
	);
});

createFixture('returns preid postfix if set - yarn', [{
	command: 'yarn config get preid',
	stdout: 'pre',
}], async ({
	testedModule: {getPreReleasePrefix},
}) => {
	assert.equal(
		await getPreReleasePrefix({cli: 'yarn'}),
		'pre',
	);
});

createFixture('returns empty string if not set - npm', [{
	command: 'npm config get preid',
	stdout: 'undefined',
}], async ({
	testedModule: {getPreReleasePrefix},
}) => {
	assert.equal(
		await getPreReleasePrefix({cli: 'npm'}),
		'',
	);
});

createFixture('returns empty string if not set - yarn', [{
	command: 'yarn config get preid',
	stdout: 'undefined',
}], async ({
	testedModule: {getPreReleasePrefix},
}) => {
	assert.equal(
		await getPreReleasePrefix({cli: 'yarn'}),
		'',
	);
});

test('no options passed', async () => {
	await assert.rejects(
		originalGetPreReleasePrefix(),
		{message: 'Config is missing key `cli`'},
	);

	await assert.rejects(
		originalGetPreReleasePrefix({}),
		{message: 'Config is missing key `cli`'},
	);
});

test('returns actual value', async t => {
	const originalPreid = process.env.NPM_CONFIG_PREID;
	t.after(() => {
		process.env.NPM_CONFIG_PREID = originalPreid;
	});

	// eslint-disable-next-line node-test/no-process-env-mutation -- restored in the `t.after` hook above; node:test has no env-scoping helper
	process.env.NPM_CONFIG_PREID = 'beta';

	assert.equal(await originalGetPreReleasePrefix({cli: 'npm'}), 'beta');
});
