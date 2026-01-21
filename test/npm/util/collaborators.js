import test from 'ava';
import {stripIndent} from 'common-tags';
import {_createFixture} from '../../_helpers/stub-execa.js';
import * as npm from '../../../source/npm/util.js';

/** @type {ReturnType<typeof _createFixture<import('../../../source/npm/util.js')>>} */
const createFixture = _createFixture('../../../source/npm/util.js', import.meta.url);

test('package.name not a string', async t => {
	await t.throwsAsync(
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

test('main', createFixture, [{
	command: accessCommand(),
	stdout: collaboratorsStdout,
}], async ({t, testedModule: {collaborators}}) => {
	t.deepEqual(
		await collaborators({name: 'np'}),
		collaboratorsStdout,
	);
});

// TODO: this is timing out, seemingly the command isn't matching for Sinon
// eslint-disable-next-line ava/no-skip-test
test.skip('external registry', createFixture, [{
	command: `${accessCommand()} --registry http://my-internal-registry.local`,
	stdout: collaboratorsStdout,
}], async ({t, testedModule: {collaborators}}) => {
	const output = await collaborators({
		name: 'np',
		publishConfig: {
			registry: 'http://my-internal-registry.local',
		},
	});

	t.deepEqual(
		JSON.parse(output),
		JSON.parse(collaboratorsStdout),
	);
});

test('non-existent', createFixture, [{
	command: accessCommand('non-existent'),
	stderr: 'npm ERR! code E404\nnpm ERR! 404 Not Found',
}], async ({t, testedModule: {collaborators}}) => {
	t.is(
		await collaborators({name: 'non-existent'}),
		false,
	);
});

test('error on default registry', createFixture, [{
	command: accessCommand('@private/pkg'),
	stderr: 'npm ERR! code E403\nnpm ERR! 403 403 Forbidden',
}], async ({t, testedModule: {collaborators}}) => {
	const {stderr} = await t.throwsAsync(collaborators({name: '@private/pkg'}));
	t.is(stderr, 'npm ERR! code E403\nnpm ERR! 403 403 Forbidden');
});

test('error on external registry - returns false', createFixture, [{
	command: `${accessCommand('@private/pkg')} --registry http://my-internal-registry.local`,
	stderr: 'npm ERR! code E403\nnpm ERR! 403 403 Forbidden',
}], async ({t, testedModule: {collaborators}}) => {
	// Errors should return false instead of throwing, since external registries
	// often don't support the collaborators endpoint.
	// See: https://github.com/sindresorhus/np/issues/420
	t.is(await collaborators({
		name: '@private/pkg',
		publishConfig: {
			registry: 'http://my-internal-registry.local',
		},
	}), false);
});
