import test from 'node:test';
import assert from 'node:assert/strict';
import esmock from 'esmock';

test('detects GitHub Actions', async () => {
	const {getOidcProvider} = await esmock('../../source/npm/oidc.js', {
		'node:process': {
			env: {
				GITHUB_ACTIONS: 'true',
				ACTIONS_ID_TOKEN_REQUEST_URL: 'https://example.com',
				ACTIONS_ID_TOKEN_REQUEST_TOKEN: 'token',
			},
		},
	});

	assert.equal(getOidcProvider(), 'github');
});

test('detects GitLab CI', async () => {
	const {getOidcProvider} = await esmock('../../source/npm/oidc.js', {
		'node:process': {
			env: {
				GITLAB_CI: 'true',
				NPM_ID_TOKEN: 'token',
			},
		},
	});

	assert.equal(getOidcProvider(), 'gitlab');
});

test('detects no OIDC', async () => {
	const {getOidcProvider} = await esmock('../../source/npm/oidc.js', {
		'node:process': {
			env: {},
		},
	});

	assert.equal(getOidcProvider(), undefined);
});
