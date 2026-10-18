import test from 'node:test';
import assert from 'node:assert/strict';
import esmock from 'esmock';
import {stripIndent} from 'common-tags';
import {_createFixture} from '../../_helpers/stub-execa.js';
import * as npm from '../../../source/npm/util.js';

/**
@type {ReturnType<typeof createFixture<typeof import('../../../source/npm/util.js')>>}
*/
const createFixture = _createFixture('../../../source/npm/util.js', import.meta.url);

test('prerelease tags query the publish registry', async () => {
	const {prereleaseTags} = await esmock('../../../source/npm/util.js', {
		execa: {
			async execa(command, arguments_) {
				assert.equal(command, 'npm');
				assert.deepEqual(arguments_, ['view', '--json', 'foo', 'dist-tags', '--registry', 'https://registry.example.com/']);
				return {stdout: JSON.stringify({beta: '2.0.0-beta.1'})};
			},
		},
	});

	assert.deepEqual(await prereleaseTags({name: 'foo', publishConfig: {registry: 'https://registry.example.com/'}}), ['beta']);
});

test('packageName not a string', async () => {
	await assert.rejects(
		npm.prereleaseTags(1),
		{message: 'Package name is required'},
	);
});

createFixture('tags: latest', [{
	command: 'npm view --json foo dist-tags',
	stdout: JSON.stringify({
		latest: '1.0.0',
	}),
}], async ({
	testedModule: {prereleaseTags},
}) => {
	assert.deepEqual(
		await prereleaseTags({name: 'foo'}),
		['next'],
	);
});

createFixture('tags: latest, beta', [{
	command: 'npm view --json foo dist-tags',
	stdout: JSON.stringify({
		latest: '1.0.0',
		beta: '2.0.0-beta',
	}),
}], async ({
	testedModule: {prereleaseTags},
}) => {
	assert.deepEqual(
		await prereleaseTags({name: 'foo'}),
		['beta'],
	);
});

createFixture('tags: array-wrapped output (npm 12)', [{
	command: 'npm view --json foo dist-tags',
	stdout: JSON.stringify([{
		latest: '1.0.0',
		beta: '2.0.0-beta',
	}]),
}], async ({
	testedModule: {prereleaseTags},
}) => {
	assert.deepEqual(
		await prereleaseTags({name: 'foo'}),
		['beta'],
	);
});

createFixture(
	'non-existent with npm 12 format (JSON error on stdout) - should not throw',
	[{
		command: 'npm view --json non-existent dist-tags',
		stdout: stripIndent`
         {
             "error": {
                 "code": "E404",
                 "summary": "Not Found - GET https://registry.npmjs.org/non-existent - Not found",
                 "detail": "The requested resource 'non-existent@*' could not be found."
             }
         }
     `,
		stderr: stripIndent`
         npm error code E404
         npm error 404 Not Found - GET https://registry.npmjs.org/non-existent - Not found
         npm error A complete log of this run can be found in: ~/.npm/_logs/...-debug.log
     `,
	}],
	async ({
		testedModule: {prereleaseTags},
	}) => {
		assert.deepEqual(
			await prereleaseTags({name: 'non-existent'}),
			['next'],
		);
	},
);

createFixture('non-existent (code 404) - should not throw', [{
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
}], async ({
	testedModule: {prereleaseTags},
}) => {
	assert.deepEqual(
		await prereleaseTags({name: 'non-existent'}),
		['next'],
	);
});

createFixture('non-existent with modern npm format (npm >=10) - should not throw', [{
	command: 'npm view --json non-existent dist-tags',
	stderr: stripIndent`
        npm error code E404
        npm error 404 Not Found - GET https://registry.npmjs.org/non-existent - Not found
        npm error 404
        npm error 404  The requested resource 'non-existent@*' could not be found or you do not have permission to access it.
        npm error 404
        npm error 404 Note that you can also install from a
        npm error 404 tarball, folder, http url, or git url.
        {
            "error": {
                "code": "E404",
                "summary": "Not Found - GET https://registry.npmjs.org/non-existent - Not found",
                "detail": "The requested resource 'non-existent@*' could not be found."
            }
        }
        npm error A complete log of this run can be found in: ~/.npm/_logs/...-debug.log
    `,
}], async ({
	testedModule: {prereleaseTags},
}) => {
	assert.deepEqual(
		await prereleaseTags({name: 'non-existent'}),
		['next'],
	);
});

createFixture('bad permission (code 403) - should throw', [{
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
}], async ({
	testedModule: {prereleaseTags},
}) => {
	const error = await prereleaseTags({name: '@private/pkg'}).catch(error => error);
	assert.ok(error.stderr?.includes('E403'));
});
