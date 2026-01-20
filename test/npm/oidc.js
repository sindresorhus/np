import test from 'ava';
import esmock from 'esmock';

test('detects GitHub Actions', async t => {
	const {getOidcProvider} = await esmock('../../source/npm/oidc.js', {
		'node:process': {
			env: {
				GITHUB_ACTIONS: 'true',
				ACTIONS_ID_TOKEN_REQUEST_URL: 'https://example.com',
				ACTIONS_ID_TOKEN_REQUEST_TOKEN: 'token',
			},
		},
	});

	t.is(getOidcProvider(), 'github');
});

test('detects GitLab CI', async t => {
	const {getOidcProvider} = await esmock('../../source/npm/oidc.js', {
		'node:process': {
			env: {
				GITLAB_CI: 'true',
				NPM_ID_TOKEN: 'token',
			},
		},
	});

	t.is(getOidcProvider(), 'gitlab');
});

test('detects no OIDC', async t => {
	const {getOidcProvider} = await esmock('../../source/npm/oidc.js', {
		'node:process': {
			env: {},
		},
	});

	t.is(getOidcProvider(), undefined);
});
