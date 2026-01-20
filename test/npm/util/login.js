import test from 'ava';
import {_createFixture} from '../../_helpers/stub-execa.js';

/** @type {ReturnType<typeof _createFixture<import('../../../source/npm/util.js')>>} */
const createFixture = _createFixture('../../../source/npm/util.js', import.meta.url);

test('main', createFixture, [{
	command: 'npm login',
	stdout: '',
}], async ({t, testedModule: npm}) => {
	await t.notThrowsAsync(npm.login({}));
});

test('--registry flag', createFixture, [{
	command: 'npm login --registry http://my.io',
	stdout: '',
}], async ({t, testedModule: npm}) => {
	await t.notThrowsAsync(npm.login({externalRegistry: 'http://my.io'}));
});

test('fails if login fails', createFixture, [{
	command: 'npm login',
	exitCode: 1,
	stderr: 'npm ERR! Login failed',
}], async ({t, testedModule: npm}) => {
	await t.throwsAsync(npm.login({}));
});
