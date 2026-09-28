import assert from 'node:assert/strict';
import {_createFixture} from '../../_helpers/stub-execa.js';

/**
@type {ReturnType<typeof createFixture<typeof import('../../../source/npm/util.js')>>}
*/
const createFixture = _createFixture('../../../source/npm/util.js', import.meta.url);

createFixture('main', [{
	command: 'npm login',
	stdout: '',
}], async ({
	testedModule: npm,
}) => {
	await assert.doesNotReject(npm.login({}));
});

createFixture('--registry flag', [{
	command: 'npm login --registry http://my.io',
	stdout: '',
}], async ({
	testedModule: npm,
}) => {
	await assert.doesNotReject(npm.login({externalRegistry: 'http://my.io'}));
});

createFixture('fails if login fails', [{
	command: 'npm login',
	exitCode: 1,
	stderr: 'npm ERR! Login failed',
}], async ({
	testedModule: npm,
}) => {
	await assert.rejects(npm.login({}));
});
