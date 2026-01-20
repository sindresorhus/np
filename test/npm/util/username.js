import test from 'ava';
import {_createFixture} from '../../_helpers/stub-execa.js';

/** @type {ReturnType<typeof _createFixture<import('../../../source/npm/util.js')>>} */
const createFixture = _createFixture('../../../source/npm/util.js', import.meta.url);

test('main', createFixture, [{
	command: 'npm whoami',
	stdout: 'sindresorhus',
}], async ({t, testedModule: npm}) => {
	t.is(await npm.username({}), 'sindresorhus');
});

test('--registry flag', createFixture, [{
	command: 'npm whoami --registry http://my.io',
	stdout: 'sindresorhus',
}], async ({t, testedModule: npm}) => {
	t.is(await npm.username({externalRegistry: 'http://my.io'}), 'sindresorhus');
});

test('fails if not logged in - ENEEDAUTH', createFixture, [{
	command: 'npm whoami',
	stderr: 'npm ERR! code ENEEDAUTH',
}], async ({t, testedModule: npm}) => {
	const error = await t.throwsAsync(
		npm.username({}),
		{message: 'You must be logged in. Use `npm login` and try again.'},
	);
	t.true(error.isNotLoggedIn);
});

test('fails if not logged in - E401', createFixture, [{
	command: 'npm whoami',
	stderr: 'npm error code E401\nnpm error 401 Unauthorized',
}], async ({t, testedModule: npm}) => {
	const error = await t.throwsAsync(
		npm.username({}),
		{message: 'You must be logged in. Use `npm login` and try again.'},
	);
	t.true(error.isNotLoggedIn);
});

test('fails with authentication error', createFixture, [{
	command: 'npm whoami',
	stderr: 'npm ERR! OTP required for authentication',
}], async ({t, testedModule: npm}) => {
	const error = await t.throwsAsync(
		npm.username({}),
		{message: 'Authentication error. Use `npm whoami` to troubleshoot.'},
	);
	t.false(error.isNotLoggedIn);
});
