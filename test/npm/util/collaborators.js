import test from 'ava';
import {stripIndent} from 'common-tags';
import {_createFixture} from '../../_helpers/stub-execa.js';
import * as npm from '../../../source/npm/util.js';

/** @type {ReturnType<typeof _createFixture<import('../../../source/npm/util.js')>>} */
const createFixture = _createFixture('../../../source/npm/util.js', import.meta.url);

test('package.name not a string', async t => {
	await t.throwsAsync(
		npm.collaborators({name: 1}),
		{message: 'Expected argument to be of type `string` but received type `number`'},
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

test('error', createFixture, [{
	command: accessCommand('@private/pkg'),
	stderr: 'npm ERR! code E403\nnpm ERR! 403 403 Forbidden',
}], async ({t, testedModule: {collaborators}}) => {
	const {stderr} = await t.throwsAsync(collaborators({name: '@private/pkg'}));
	t.is(stderr, 'npm ERR! code E403\nnpm ERR! 403 403 Forbidden');
});

