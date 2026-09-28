import test from 'node:test';
import assert from 'node:assert/strict';
import {stripIndent} from 'common-tags';
import {_createFixture} from '../../_helpers/stub-execa.js';
import * as npm from '../../../source/npm/util.js';

/**
@type {ReturnType<typeof createFixture<typeof import('../../../source/npm/util.js')>>}
*/
const createFixture = _createFixture('../../../source/npm/util.js', import.meta.url);

test('package.name not a string', async () => {
	await assert.rejects(
		npm.collaborators({name: 1}),
		{message: 'Package name is required'},
	);
});

const accessCommand = (name = 'np') => `npm access list collaborators ${name} --json`;

const collaboratorsStdout = stripIndent`
    {
        "sindresorhus": "read-write",
        "samverschueren": "read-write",
        "itaisteinherz": "read-write"
    }
`;

createFixture('main', [{
	command: accessCommand(),
	stdout: collaboratorsStdout,
}], async ({
	testedModule: {collaborators},
}) => {
	assert.deepEqual(
		await collaborators({name: 'np'}),
		collaboratorsStdout,
	);
});

// TODO: this is timing out, seemingly the command isn't matching for Sinon
// eslint-disable-next-line node-test/no-skip-test
test.skip('external registry', createFixture, [{
	command: `${accessCommand()} --registry http://my-internal-registry.local`,
	stdout: collaboratorsStdout,
}], async ({
	testedModule: {collaborators},
}) => {
	const output = await collaborators({
		name: 'np',
		publishConfig: {
			registry: 'http://my-internal-registry.local',
		},
	});

	assert.deepEqual(
		JSON.parse(output),
		JSON.parse(collaboratorsStdout),
	);
});

createFixture('non-existent', [{
	command: accessCommand('non-existent'),
	stderr: 'npm ERR! code E404\nnpm ERR! 404 Not Found',
}], async ({
	testedModule: {collaborators},
}) => {
	assert.ok(!(await collaborators({name: 'non-existent'})));
});

createFixture('error on default registry', [{
	command: accessCommand('@private/pkg'),
	stderr: 'npm ERR! code E403\nnpm ERR! 403 403 Forbidden',
}], async ({
	testedModule: {collaborators},
}) => {
	const {stderr} = await collaborators({name: '@private/pkg'}).catch(error => error);
	assert.equal(stderr, 'npm ERR! code E403\nnpm ERR! 403 403 Forbidden');
});

createFixture('error on external registry - returns false', [{
	command: `${accessCommand('@private/pkg')} --registry https://my-internal-registry.local`,
	stderr: 'npm ERR! code E403\nnpm ERR! 403 403 Forbidden',
}], async ({
	testedModule: {collaborators},
}) => {
	// Errors should return false instead of throwing, since external registries
	// often don't support the collaborators endpoint.
	// See: https://github.com/sindresorhus/np/issues/420
	assert.ok(!(await collaborators({
		name: '@private/pkg',
		publishConfig: {
			registry: 'https://my-internal-registry.local',
		},
	})));
});
