import test from 'ava';
import {stripIndent} from 'common-tags';
import {_createFixture} from '../../_helpers/stub-execa.js';
import * as npm from '../../../source/npm/util.js';

/** @type {ReturnType<typeof _createFixture<import('../../../source/npm/util.js')>>} */
const createFixture = _createFixture('../../../source/npm/util.js', import.meta.url);

test('packageName not a string', async t => {
	await t.throwsAsync(
		npm.prereleaseTags(1),
		{message: 'Expected argument to be of type `string` but received type `number`'},
	);
});

test('tags: latest', createFixture, [{
	command: 'npm view --json foo dist-tags',
	stdout: JSON.stringify({
		latest: '1.0.0',
	}),
}], async ({t, testedModule: {prereleaseTags}}) => {
	t.deepEqual(
		await prereleaseTags('foo'),
		['next'],
	);
});

test('tags: latest, beta', createFixture, [{
	command: 'npm view --json foo dist-tags',
	stdout: JSON.stringify({
		latest: '1.0.0',
		beta: '2.0.0-beta',
	}),
}], async ({t, testedModule: {prereleaseTags}}) => {
	t.deepEqual(
		await prereleaseTags('foo'),
		['beta'],
	);
});

test('non-existent (code 404) - should not throw', createFixture, [{
	command: 'npm view --json non-existent dist-tags',
	stderr: stripIndent`
		npm ERR! code E404
		npm ERR! 404 Not Found - GET https://registry.npmjs.org/non-existent - Not found
		npm ERR! 404
		npm ERR! 404  'non-existent@*' is not in this registry.
		npm ERR! 404
		npm ERR! 404 Note that you can also install from a
		npm ERR! 404 tarball, folder, http url, or git url.
		{
			"error": {
				"code": "E404",
				"summary": "Not Found - GET https://registry.npmjs.org/non-existent - Not found",
				"detail": "'non-existent@*' is not in this registry. Note that you can also install from a tarball, folder, http url, or git url."
			}
		}
		npm ERR! A complete log of this run can be found in:
		npm ERR!     ~/.npm/_logs/...-debug.log
	`,
}], async ({t, testedModule: {prereleaseTags}}) => {
	t.deepEqual(
		await prereleaseTags('non-existent'),
		['next'],
	);
});

test('bad permission (code 403) - should throw', createFixture, [{
	command: 'npm view --json @private/pkg dist-tags',
	stderr: stripIndent`
		npm ERR! code E403
		npm ERR! 403 403 Forbidden - GET https://registry.npmjs.org/@private%2fpkg - Forbidden
		npm ERR! 403 In most cases, you or one of your dependencies are requesting
		npm ERR! 403 a package version that is forbidden by your security policy, or
		npm ERR! 403 on a server you do not have access to.
		{
			"error": {
				"code": "E403",
				"summary": "403 Forbidden - GET https://registry.npmjs.org/@private%2fpkg - Forbidden",
				"detail": "In most cases, you or one of your dependencies are requesting a package version that is forbidden by your security policy, or on a server you do not have access to."
			}
		}
		npm ERR! A complete log of this run can be found in:
		npm ERR!     ~/.npm/_logs/...-debug.log
	`,
}], async ({t, testedModule: {prereleaseTags}}) => {
	const error = await t.throwsAsync(prereleaseTags('@private/pkg'));
	t.true(error.stderr?.includes('E403'));
});
