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

for (const {env, expected, title} of [
	{env: {CIRCLECI: 'true', NPM_ID_TOKEN: 'token'}, expected: 'circleci', title: 'detects CircleCI with an npm OIDC token'},
	{env: {CIRCLECI: 'true'}, expected: undefined, title: 'does not detect CircleCI without an npm OIDC token'},
	{env: {NPM_ID_TOKEN: 'token'}, expected: undefined, title: 'does not detect an OIDC token outside a supported CI provider'},
]) {
	test(title, async () => {
		const {getOidcProvider} = await esmock('../../source/npm/oidc.js', {
			'node:process': {env},
		});

		assert.equal(getOidcProvider(), expected);
	});
}

test('detects no OIDC', async () => {
	const {getOidcProvider} = await esmock('../../source/npm/oidc.js', {
		'node:process': {
			env: {},
		},
	});

	assert.equal(getOidcProvider(), undefined);
});
