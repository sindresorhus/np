import process from 'node:process';
import test from 'ava';
import actualPrerequisiteTasks from '../../source/prerequisite-tasks.js';
import {npPkg} from '../../source/util.js';
import {SilentRenderer} from '../_helpers/listr-renderer.js';
import {_createFixture} from '../_helpers/stub-execa.js';
import {run, assertTaskFailed, assertTaskDisabled} from '../_helpers/listr.js';

/** @type {ReturnType<typeof _createFixture<import('../../source/prerequisite-tasks.js')>>} */
const createFixture = _createFixture('../../source/prerequisite-tasks.js', import.meta.url);

test.afterEach(() => {
	SilentRenderer.clearTasks();
});

test.serial('public-package published on npm registry: should fail when npm registry not pingable', createFixture, [{
	command: 'npm ping',
	exitCode: 1,
	exitCodeName: 'EPERM',
	stdout: '',
	stderr: 'failed',
}], async ({t, testedModule: prerequisiteTasks}) => {
	await t.throwsAsync(
		run(prerequisiteTasks('1.0.0', {name: 'test'}, {})),
		{message: 'Connection to npm registry failed'},
	);

	assertTaskFailed(t, 'Ping npm registry');
});

test.serial('private package: should disable task pinging npm registry', createFixture, [{
	command: 'git rev-parse --quiet --verify refs/tags/v2.0.0',
	stdout: '',
}], async ({t, testedModule: prerequisiteTasks}) => {
	await t.notThrowsAsync(
		run(prerequisiteTasks('2.0.0', {name: 'test', version: '1.0.0', private: true}, {yarn: false})),
	);

	assertTaskDisabled(t, 'Ping npm registry');
});

test.serial('external registry: should disable task pinging npm registry', createFixture, [{
	command: 'git rev-parse --quiet --verify refs/tags/v2.0.0',
	stdout: '',
}], async ({t, testedModule: prerequisiteTasks}) => {
	await t.notThrowsAsync(
		run(prerequisiteTasks('2.0.0', {name: 'test', version: '1.0.0', publishConfig: {registry: 'http://my.io'}}, {yarn: false})),
	);

	assertTaskDisabled(t, 'Ping npm registry');
});

test.serial('should fail when npm version does not match range in `package.json`', createFixture, [
	{
		command: 'npm --version',
		stdout: '6.0.0',
	},
	{
		command: 'git rev-parse --quiet --verify refs/tags/v2.0.0',
		stdout: '',
	},
], async ({t, testedModule: prerequisiteTasks}) => {
	const depRange = npPkg.engines.npm;

	await t.throwsAsync(
		run(prerequisiteTasks('2.0.0', {name: 'test', version: '1.0.0'}, {yarn: false})),
		{message: `\`np\` requires npm ${depRange}`},
	);

	assertTaskFailed(t, 'Check npm version');
});

test.serial('should fail when yarn version does not match range in `package.json`', createFixture, [
	{
		command: 'yarn --version',
		stdout: '1.0.0',
	},
	{
		command: 'git rev-parse --quiet --verify refs/tags/v2.0.0',
		stdout: '',
	},
], async ({t, testedModule: prerequisiteTasks}) => {
	const depRange = npPkg.engines.yarn;

	await t.throwsAsync(
		run(prerequisiteTasks('2.0.0', {name: 'test', version: '1.0.0'}, {yarn: true})),
		{message: `\`np\` requires yarn ${depRange}`},
	);

	assertTaskFailed(t, 'Check yarn version');
});

test.serial('should fail when user is not authenticated at npm registry', createFixture, [
	{
		command: 'npm whoami',
		stdout: 'sindresorhus',
	},
	{
		command: 'npm access list collaborators test',
		stdout: '{"sindresorhus": "read"}',
	},
], async ({t, testedModule: prerequisiteTasks}) => {
	process.env.NODE_ENV = 'P';

	await t.throwsAsync(
		run(prerequisiteTasks('2.0.0', {name: 'test', version: '1.0.0'}, {yarn: false})),
		{message: 'You do not have write permissions required to publish this package.'},
	);

	process.env.NODE_ENV = 'test';

	assertTaskFailed(t, 'Verify user is authenticated');
});

test.serial('should fail when user is not authenticated at external registry', createFixture, [
	{
		command: 'npm whoami --registry http://my.io',
		stdout: 'sindresorhus',
	},
	{
		command: 'npm access list collaborators test --json --registry http://my.io',
		stdout: '{"sindresorhus": "read"}',
	},
], async ({t, testedModule: prerequisiteTasks}) => {
	process.env.NODE_ENV = 'P';

	await t.throwsAsync(
		run(prerequisiteTasks('2.0.0', {name: 'test', version: '1.0.0', publishConfig: {registry: 'http://my.io'}}, {yarn: false})),
		{message: 'You do not have write permissions required to publish this package.'},
	);

	process.env.NODE_ENV = 'test';

	assertTaskFailed(t, 'Verify user is authenticated');
});

test.serial.todo('should not fail if no collaborators'); // Verify user is authenticated

test.serial('private package: should disable task `verify user is authenticated`', createFixture, [{
	command: 'git rev-parse --quiet --verify refs/tags/v2.0.0',
	stdout: '',
}], async ({t, testedModule: prerequisiteTasks}) => {
	process.env.NODE_ENV = 'P';

	await t.notThrowsAsync(
		run(prerequisiteTasks('2.0.0', {name: 'test', version: '1.0.0', private: true}, {yarn: false})),
	);

	process.env.NODE_ENV = 'test';

	assertTaskDisabled(t, 'Verify user is authenticated');
});

test.serial('should fail when git version does not match range in `package.json`', createFixture, [{
	command: 'git version',
	stdout: 'git version 1.0.0',
}], async ({t, testedModule: prerequisiteTasks}) => {
	const depRange = npPkg.engines.git;

	await t.throwsAsync(
		run(prerequisiteTasks('2.0.0', {name: 'test', version: '1.0.0'}, {yarn: false})),
		{message: `\`np\` requires git ${depRange}`},
	);

	assertTaskFailed(t, 'Check git version');
});

test.serial('should fail when git remote does not exist', createFixture, [{
	command: 'git ls-remote origin HEAD',
	exitCode: 1,
	exitCodeName: 'EPERM',
	stderr: 'not found',
}], async ({t, testedModule: prerequisiteTasks}) => {
	await t.throwsAsync(
		run(prerequisiteTasks('2.0.0', {name: 'test', version: '1.0.0'}, {yarn: false})),
		{message: 'not found'},
	);

	assertTaskFailed(t, 'Check git remote');
});

test.serial('should fail when version is invalid', async t => {
	await t.throwsAsync(
		run(actualPrerequisiteTasks('DDD', {name: 'test', version: '1.0.0'}, {yarn: false})),
		{message: 'New version DDD should either be one of patch, minor, major, prepatch, preminor, premajor, prerelease, or a valid SemVer version.'},
	);

	assertTaskFailed(t, 'Validate version');
});

test.serial('should fail when version is lower than latest version', async t => {
	await t.throwsAsync(
		run(actualPrerequisiteTasks('0.1.0', {name: 'test', version: '1.0.0'}, {yarn: false})),
		{message: 'New version 0.1.0 should be higher than current version 1.0.0.'},
	);

	assertTaskFailed(t, 'Validate version');
});

test.serial('should fail when prerelease version of public package without dist tag given', async t => {
	await t.throwsAsync(
		run(actualPrerequisiteTasks('2.0.0-1', {name: 'test', version: '1.0.0'}, {yarn: false})),
		{message: 'You must specify a dist-tag using --tag when publishing a pre-release version. This prevents accidentally tagging unstable versions as "latest". https://docs.npmjs.com/cli/dist-tag'},
	);

	assertTaskFailed(t, 'Check for pre-release version');
});

test.serial('should not fail when prerelease version of public package with dist tag given', createFixture, [{
	command: 'git rev-parse --quiet --verify refs/tags/v2.0.0',
	stdout: '',
}], async ({t, testedModule: prerequisiteTasks}) => {
	await t.notThrowsAsync(
		run(prerequisiteTasks('2.0.0-1', {name: 'test', version: '1.0.0'}, {yarn: false, tag: 'pre'})),
	);
});

test.serial('should not fail when prerelease version of private package without dist tag given', createFixture, [{
	command: 'git rev-parse --quiet --verify refs/tags/v2.0.0',
	stdout: '',
}], async ({t, testedModule: prerequisiteTasks}) => {
	await t.notThrowsAsync(
		run(prerequisiteTasks('2.0.0-1', {name: 'test', version: '1.0.0', private: true}, {yarn: false})),
	);
});

test.serial('should fail when git tag already exists', createFixture, [{
	command: 'git rev-parse --quiet --verify refs/tags/v2.0.0',
	stdout: 'vvb',
}], async ({t, testedModule: prerequisiteTasks}) => {
	await t.throwsAsync(
		run(prerequisiteTasks('2.0.0', {name: 'test', version: '1.0.0'}, {yarn: false})),
		{message: 'Git tag `v2.0.0` already exists.'},
	);

	assertTaskFailed(t, 'Check git tag existence');
});

test.serial('checks should pass', createFixture, [{
	command: 'git rev-parse --quiet --verify refs/tags/v2.0.0',
	stdout: '',
}], async ({t, testedModule: prerequisiteTasks}) => {
	await t.notThrowsAsync(
		run(prerequisiteTasks('2.0.0', {name: 'test', version: '1.0.0'}, {yarn: false})),
	);
});
