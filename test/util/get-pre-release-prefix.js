import process from 'node:process';
import test from 'ava';
import {_createFixture} from '../_helpers/stub-execa.js';
import {getPreReleasePrefix as originalGetPreReleasePrefix} from '../../source/util.js';

/** @type {ReturnType<typeof _createFixture<import('../../source/util.js')>>} */
const createFixture = _createFixture('../../source/util.js', import.meta.url);

test('returns preid postfix if set - npm', createFixture, [{
	command: 'npm config get preid',
	stdout: 'pre',
}], async ({t, testedModule: {getPreReleasePrefix}}) => {
	t.is(
		await getPreReleasePrefix({cli: 'npm'}),
		'pre',
	);
});

test('returns preid postfix if set - yarn', createFixture, [{
	command: 'yarn config get preid',
	stdout: 'pre',
}], async ({t, testedModule: {getPreReleasePrefix}}) => {
	t.is(
		await getPreReleasePrefix({cli: 'yarn'}),
		'pre',
	);
});

test('returns empty string if not set - npm', createFixture, [{
	command: 'npm config get preid',
	stdout: 'undefined',
}], async ({t, testedModule: {getPreReleasePrefix}}) => {
	t.is(
		await getPreReleasePrefix({cli: 'npm'}),
		'',
	);
});

test('returns empty string if not set - yarn', createFixture, [{
	command: 'yarn config get preid',
	stdout: 'undefined',
}], async ({t, testedModule: {getPreReleasePrefix}}) => {
	t.is(
		await getPreReleasePrefix({cli: 'yarn'}),
		'',
	);
});

test('no options passed', async t => {
	await t.throwsAsync(
		originalGetPreReleasePrefix(),
		{message: 'Config is missing key `cli`'},
	);

	await t.throwsAsync(
		originalGetPreReleasePrefix({}),
		{message: 'Config is missing key `cli`'},
	);
});

test.serial('returns actual value', async t => {
	const originalPreid = process.env.NPM_CONFIG_PREID;
	process.env.NPM_CONFIG_PREID = 'beta';

	t.is(await originalGetPreReleasePrefix({cli: 'npm'}), 'beta');

	process.env.NPM_CONFIG_PREID = originalPreid;
});
