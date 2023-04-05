import process from 'node:process';
import test from 'ava';
import {readPackageUp} from 'read-pkg-up';
import Version from '../source/version.js';
import actualPrerequisiteTasks from '../source/prerequisite-tasks.js';
import {SilentRenderer} from './fixtures/listr-renderer.js';
import {
	_stubExeca,
	run,
	assertTaskFailed,
	assertTaskDisabled,
} from './_utils.js';

/** @type {(...args: ReturnType<_stubExeca>) => Promise<import('../source/prerequisite-tasks.js').default>} */
const stubExeca = _stubExeca('../source/prerequisite-tasks.js');
const {packageJson: pkg} = await readPackageUp();

test.afterEach(() => {
	SilentRenderer.clearTasks();
});

test.serial('public-package published on npm registry: should fail when npm registry not pingable', async t => {
	const prerequisiteTasks = await stubExeca([{
		command: 'npm ping',
		exitCode: 1,
		exitCodeName: 'EPERM',
		stdout: '',
		stderr: 'failed',
	}]);

	await t.throwsAsync(
		run(prerequisiteTasks('1.0.0', {name: 'test'}, {})),
		{message: 'Connection to npm registry failed'},
	);

	assertTaskFailed(t, 'Ping npm registry');
});

test.serial('private package: should disable task pinging npm registry', async t => {
	const prerequisiteTasks = await stubExeca([{
		command: 'git rev-parse --quiet --verify refs/tags/v2.0.0',
		exitCode: 0,
		stdout: '',
	}]);

	await t.notThrowsAsync(
		run(prerequisiteTasks('2.0.0', {name: 'test', version: '1.0.0', private: true}, {yarn: false})),
	);

	assertTaskDisabled(t, 'Ping npm registry');
});

test.serial('external registry: should disable task pinging npm registry', async t => {
	const prerequisiteTasks = await stubExeca([{
		command: 'git rev-parse --quiet --verify refs/tags/v2.0.0',
		exitCode: 0,
		stdout: '',
	}]);

	await t.notThrowsAsync(
		run(prerequisiteTasks('2.0.0', {name: 'test', version: '1.0.0', publishConfig: {registry: 'http://my.io'}}, {yarn: false})),
	);

	assertTaskDisabled(t, 'Ping npm registry');
});

test.serial('should fail when npm version does not match range in `package.json`', async t => {
	const prerequisiteTasks = await stubExeca([
		{
			command: 'npm --version',
			exitCode: 0,
			stdout: '6.0.0',
		},
		{
			command: 'git rev-parse --quiet --verify refs/tags/v2.0.0',
			exitCode: 0,
			stdout: '',
		},
	]);

	const depRange = pkg.engines.npm;

	await t.throwsAsync(
		run(prerequisiteTasks('2.0.0', {name: 'test', version: '1.0.0'}, {yarn: false})),
		{message: `Please upgrade to npm${depRange}`},
	);

	assertTaskFailed(t, 'Check npm version');
});

test.serial('should fail when yarn version does not match range in `package.json`', async t => {
	const prerequisiteTasks = await stubExeca([
		{
			command: 'yarn --version',
			exitCode: 0,
			stdout: '1.0.0',
		},
		{
			command: 'git rev-parse --quiet --verify refs/tags/v2.0.0',
			exitCode: 0,
			stdout: '',
		},
	]);

	const depRange = pkg.engines.yarn;

	await t.throwsAsync(
		run(prerequisiteTasks('2.0.0', {name: 'test', version: '1.0.0'}, {yarn: true})),
		{message: `Please upgrade to yarn${depRange}`},
	);

	assertTaskFailed(t, 'Check yarn version');
});

test.serial('should fail when user is not authenticated at npm registry', async t => {
	const prerequisiteTasks = await stubExeca([
		{
			command: 'npm whoami',
			exitCode: 0,
			stdout: 'sindresorhus',
		},
		{
			command: 'npm access ls-collaborators test',
			exitCode: 0,
			stdout: '{"sindresorhus": "read"}',
		},
	]);

	process.env.NODE_ENV = 'P';

	await t.throwsAsync(
		run(prerequisiteTasks('2.0.0', {name: 'test', version: '1.0.0'}, {yarn: false})),
		{message: 'You do not have write permissions required to publish this package.'},
	);

	process.env.NODE_ENV = 'test';

	assertTaskFailed(t, 'Verify user is authenticated');
});

test.serial('should fail when user is not authenticated at external registry', async t => {
	const prerequisiteTasks = await stubExeca([
		{
			command: 'npm whoami --registry http://my.io',
			exitCode: 0,
			stdout: 'sindresorhus',
		},
		{
			command: 'npm access ls-collaborators test --registry http://my.io',
			exitCode: 0,
			stdout: '{"sindresorhus": "read"}',
		},
		{
			command: 'npm access list collaborators test --json --registry http://my.io',
			exitCode: 0,
			stdout: '{"sindresorhus": "read"}',
		},
	]);

	process.env.NODE_ENV = 'P';

	await t.throwsAsync(
		run(prerequisiteTasks('2.0.0', {name: 'test', version: '1.0.0', publishConfig: {registry: 'http://my.io'}}, {yarn: false})),
		{message: 'You do not have write permissions required to publish this package.'},
	);

	process.env.NODE_ENV = 'test';

	assertTaskFailed(t, 'Verify user is authenticated');
});

test.serial('private package: should disable task `verify user is authenticated`', async t => {
	const prerequisiteTasks = await stubExeca([{
		command: 'git rev-parse --quiet --verify refs/tags/v2.0.0',
		exitCode: 0,
		stdout: '',
	}]);

	process.env.NODE_ENV = 'P';

	await t.notThrowsAsync(
		run(prerequisiteTasks('2.0.0', {name: 'test', version: '1.0.0', private: true}, {yarn: false})),
	);

	process.env.NODE_ENV = 'test';

	assertTaskDisabled(t, 'Verify user is authenticated');
});

test.serial('should fail when git version does not match range in `package.json`', async t => {
	const prerequisiteTasks = await stubExeca([{
		command: 'git version',
		exitCode: 0,
		stdout: 'git version 1.0.0',
	}]);

	const depRange = pkg.engines.git;

	await t.throwsAsync(
		run(prerequisiteTasks('2.0.0', {name: 'test', version: '1.0.0'}, {yarn: false})),
		{message: `Please upgrade to git${depRange}`},
	);

	assertTaskFailed(t, 'Check git version');
});

test.serial('should fail when git remote does not exist', async t => {
	const prerequisiteTasks = await stubExeca([{
		command: 'git ls-remote origin HEAD',
		exitCode: 1,
		exitCodeName: 'EPERM',
		stderr: 'not found',
	}]);

	await t.throwsAsync(
		run(prerequisiteTasks('2.0.0', {name: 'test', version: '1.0.0'}, {yarn: false})),
		{message: 'not found'},
	);

	assertTaskFailed(t, 'Check git remote');
});

test.serial('should fail when version is invalid', async t => {
	await t.throwsAsync(
		run(actualPrerequisiteTasks('DDD', {name: 'test', version: '1.0.0'}, {yarn: false})),
		{message: `Version should be either ${Version.SEMVER_INCREMENTS.join(', ')}, or a valid semver version.`},
	);

	assertTaskFailed(t, 'Validate version');
});

test.serial('should fail when version is lower as latest version', async t => {
	await t.throwsAsync(
		run(actualPrerequisiteTasks('0.1.0', {name: 'test', version: '1.0.0'}, {yarn: false})),
		{message: 'New version `0.1.0` should be higher than current version `1.0.0`'},
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

test.serial('should not fail when prerelease version of public package with dist tag given', async t => {
	const prerequisiteTasks = await stubExeca([{
		command: 'git rev-parse --quiet --verify refs/tags/v2.0.0',
		stdout: '',
	}]);

	await t.notThrowsAsync(
		run(prerequisiteTasks('2.0.0-1', {name: 'test', version: '1.0.0'}, {yarn: false, tag: 'pre'})),
	);
});

test.serial('should not fail when prerelease version of private package without dist tag given', async t => {
	const prerequisiteTasks = await stubExeca([{
		command: 'git rev-parse --quiet --verify refs/tags/v2.0.0',
		stdout: '',
	}]);

	await t.notThrowsAsync(
		run(prerequisiteTasks('2.0.0-1', {name: 'test', version: '1.0.0', private: true}, {yarn: false})),
	);
});

test.serial('should fail when git tag already exists', async t => {
	const prerequisiteTasks = await stubExeca([{
		command: 'git rev-parse --quiet --verify refs/tags/v2.0.0',
		stdout: 'vvb',
	}]);

	await t.throwsAsync(
		run(prerequisiteTasks('2.0.0', {name: 'test', version: '1.0.0'}, {yarn: false})),
		{message: 'Git tag `v2.0.0` already exists.'},
	);

	assertTaskFailed(t, 'Check git tag existence');
});

test.serial('checks should pass', async t => {
	const prerequisiteTasks = await stubExeca([{
		command: 'git rev-parse --quiet --verify refs/tags/v2.0.0',
		stdout: '',
	}]);

	await t.notThrowsAsync(
		run(prerequisiteTasks('2.0.0', {name: 'test', version: '1.0.0'}, {yarn: false})),
	);
});
