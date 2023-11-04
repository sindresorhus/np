import test from 'ava';
import {stripIndent} from 'common-tags';
import {_createFixture} from '../../_helpers/stub-execa.js';
import * as npm from '../../../source/npm/util.js';

/** @type {ReturnType<typeof _createFixture<import('../../../source/npm/util.js')>>} */
const createFixture = _createFixture('../../../source/npm/util.js', import.meta.url);

test('pkg.name not a string', async t => {
	await t.throwsAsync(
		npm.collaborators({name: 1}),
		{message: 'Expected argument to be of type `string` but received type `number`'},
	);
});

const npmVersionFixtures = [
	{version: '9.0.0', accessCommand: 'npm access list collaborators np --json'},
];

for (const {version, accessCommand} of npmVersionFixtures) {
	const npmVersionCommand = {
		command: 'npm --version',
		stdout: version,
	};

	const collaboratorsStdout = stripIndent`
		{
			"sindresorhus": "read-write",
			"samverschueren": "read-write",
			"itaisteinherz": "read-write"
		}
	`;

	test(`npm v${version}`, createFixture, [
		npmVersionCommand,
		{
			command: accessCommand,
			stdout: collaboratorsStdout,
		},
	], async ({t, testedModule: {collaborators}}) => {
		t.deepEqual(
			await collaborators({name: 'np'}),
			collaboratorsStdout,
		);
	});

	test(`npm v${version} - external registry`, createFixture, [
		npmVersionCommand,
		{
			command: `${accessCommand} --registry http://my-internal-registry.local`,
			stdout: collaboratorsStdout,
		},
	], async ({t, testedModule: {collaborators}}) => {
		t.deepEqual(
			await collaborators({
				name: 'np',
				publishConfig: {
					registry: 'http://my-internal-registry.local',
				},
			}),
			collaboratorsStdout,
		);
	});

	test(`npm v${version} - non-existent`, createFixture, [
		npmVersionCommand,
		{
			command: 'npm access list collaborators non-existent --json',
			stderr: 'npm ERR! code E404\nnpm ERR! 404 Not Found',
		},
	], async ({t, testedModule: {collaborators}}) => {
		t.is(
			await collaborators({name: 'non-existent'}),
			false,
		);
	});

	test(`npm v${version} - error`, createFixture, [
		npmVersionCommand,
		{
			command: 'npm access list collaborators @private/pkg --json',
			stderr: 'npm ERR! code E403\nnpm ERR! 403 403 Forbidden',
		},
	], async ({t, testedModule: {collaborators}}) => {
		const {stderr} = await t.throwsAsync(collaborators({name: '@private/pkg'}));
		t.is(stderr, 'npm ERR! code E403\nnpm ERR! 403 403 Forbidden');
	});
}
