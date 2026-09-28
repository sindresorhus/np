import assert from 'node:assert/strict';
import {_createFixture} from '../../_helpers/stub-execa.js';

/**
@type {ReturnType<typeof createFixture<typeof import('../../../source/npm/util.js')>>}
*/
const createFixture = _createFixture('../../../source/npm/util.js', import.meta.url);

createFixture('main', [{
	command: 'npm whoami',
	stdout: 'sindresorhus',
}], async ({
	testedModule: npm,
}) => {
	assert.equal(await npm.username({}), 'sindresorhus');
});

createFixture('--registry flag', [{
	command: 'npm whoami --registry http://my.io',
	stdout: 'sindresorhus',
}], async ({
	testedModule: npm,
}) => {
	assert.equal(await npm.username({externalRegistry: 'http://my.io'}), 'sindresorhus');
});

createFixture('fails if not logged in - ENEEDAUTH', [{
	command: 'npm whoami',
	stderr: 'npm ERR! code ENEEDAUTH',
}], async ({
	testedModule: npm,
}) => {
	const error = await npm.username({}).catch(error => error);
	assert.equal(error.message, 'You must be logged in. Use `npm login` and try again.');
	assert.ok(error.isNotLoggedIn);
});

createFixture('fails if not logged in - E401', [{
	command: 'npm whoami',
	stderr: 'npm error code E401\nnpm error 401 Unauthorized',
}], async ({
	testedModule: npm,
}) => {
	const error = await npm.username({}).catch(error => error);
	assert.equal(error.message, 'You must be logged in. Use `npm login` and try again.');
	assert.ok(error.isNotLoggedIn);
});

createFixture('fails with authentication error', [{
	command: 'npm whoami',
	stderr: 'npm ERR! OTP required for authentication',
}], async ({
	testedModule: npm,
}) => {
	const error = await npm.username({}).catch(error => error);
	assert.equal(error.message, 'Authentication error. Use `npm whoami` to troubleshoot.');
	assert.ok(!(error.isNotLoggedIn));
});
