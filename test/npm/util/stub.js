import {setTimeout} from 'node:timers/promises';
import test from 'ava';
import esmock from 'esmock';
import {_createFixture} from '../../_helpers/stub-execa.js';

/** @type {ReturnType<typeof _createFixture<import('../../../source/npm/util.js')>>} */
const createFixture = _createFixture('../../../source/npm/util.js', import.meta.url);

test('npm.checkConnection - success', createFixture, [{
	command: 'npm ping',
	exitCode: 0,
}], async ({t, testedModule: npm}) => {
	t.true(await npm.checkConnection());
});

test('npm.checkConnection - fail', createFixture, [{
	command: 'npm ping',
	exitCode: 1,
}], async ({t, testedModule: npm}) => {
	await t.throwsAsync(
		npm.checkConnection(),
		{message: 'Connection to npm registry failed'},
	);
});

// TODO: find way to timeout without timing out ava
test.failing('npm.checkConnection - timeout', async t => {
	const npm = await esmock('../../../source/npm/util.js', {}, {
		execa: {execa: async () => setTimeout(16_000, {})},
	});

	await t.throwsAsync(
		npm.checkConnection(),
		{message: 'Connection to npm registry timed out'},
	);
});

test('npm.username', createFixture, [{
	command: 'npm whoami',
	stdout: 'sindresorhus',
}], async ({t, testedModule: npm}) => {
	t.is(await npm.username({}), 'sindresorhus');
});

test('npm.username - --registry flag', createFixture, [{
	command: 'npm whoami --registry http://my.io',
	stdout: 'sindresorhus',
}], async ({t, testedModule: npm}) => {
	t.is(await npm.username({externalRegistry: 'http://my.io'}), 'sindresorhus');
});

test('npm.username - fails if not logged in', createFixture, [{
	command: 'npm whoami',
	stderr: 'npm ERR! code ENEEDAUTH',
}], async ({t, testedModule: npm}) => {
	await t.throwsAsync(
		npm.username({}),
		{message: 'You must be logged in. Use `npm login` and try again.'},
	);
});

test('npm.username - fails with authentication error', createFixture, [{
	command: 'npm whoami',
	stderr: 'npm ERR! OTP required for authentication',
}], async ({t, testedModule: npm}) => {
	await t.throwsAsync(
		npm.username({}),
		{message: 'Authentication error. Use `npm whoami` to troubleshoot.'},
	);
});

test('npm.verifyRecentNpmVersion - satisfied', createFixture, [{
	command: 'npm --version',
	stdout: '7.20.0', // One higher than minimum
}], async ({t, testedModule: npm}) => {
	await t.notThrowsAsync(
		npm.verifyRecentNpmVersion(),
	);
});

test('npm.verifyRecentNpmVersion - not satisfied', createFixture, [{
	command: 'npm --version',
	stdout: '7.18.0', // One lower than minimum
}], async ({t, testedModule: npm}) => {
	await t.throwsAsync(
		npm.verifyRecentNpmVersion(),
		{message: 'Please upgrade to npm>=7.19.0'}, // TODO: add space to error message?
	);
});
