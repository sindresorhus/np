import test from 'ava';
import execaStub from 'execa_test_double';
import mockery from 'mockery';
import {Listr} from 'listr2';
import version from '../source/version';
import {SilentRenderer} from './fixtures/listr-renderer';

let testedModule;

const run = async listr => {
	const listrStub = new Listr(listr.task, {renderer: SilentRenderer});
	await listrStub.run();
};

test.before(() => {
	mockery.registerMock('execa', execaStub.execa);
	mockery.enable({
		useCleanCache: true,
		warnOnReplace: false,
		warnOnUnregistered: false
	});
	testedModule = require('../source/prerequisite-tasks');
});

test.beforeEach(() => {
	execaStub.resetStub();
});

test.serial('public-package published on npm registry: should fail when npm registry not pingable', async t => {
	execaStub.createStub([{
		command: 'npm ping',
		exitCode: 1,
		exitCodeName: 'EPERM',
		stdout: '',
		stderr: 'failed'
	}]);
	await t.throwsAsync(run(testedModule('1.0.0', {name: 'test'}, {})),
		{message: 'Connection to npm registry failed'});
	t.true(SilentRenderer.tasks.some(task => task.title === 'Ping npm registry' && task.hasFailed()));
});

test.serial('private package: should disable task pinging npm registry', async t => {
	execaStub.createStub([
		{
			command: 'git rev-parse --quiet --verify refs/tags/v2.0.0',
			exitCode: 0,
			stdout: ''
		}
	]);
	await run(testedModule('2.0.0', {name: 'test', version: '1.0.0', private: true}, {yarn: false}));
	t.true(SilentRenderer.tasks.some(task => task.title === 'Ping npm registry' && !task.isEnabled()));
});

test.serial('external registry: should disable task pinging npm registry', async t => {
	execaStub.createStub([
		{
			command: 'git rev-parse --quiet --verify refs/tags/v2.0.0',
			exitCode: 0,
			stdout: ''
		}
	]);
	await run(testedModule('2.0.0', {name: 'test', version: '1.0.0', publishConfig: {registry: 'http://my.io'}},
		{yarn: false}));
	t.true(SilentRenderer.tasks.some(task => task.title === 'Ping npm registry' && !task.isEnabled()));
});

test.serial('should fail when npm version does not match range in `package.json`', async t => {
	execaStub.createStub([
		{
			command: 'npm --version',
			exitCode: 0,
			stdout: '6.0.0'
		},
		{
			command: 'git rev-parse --quiet --verify refs/tags/v2.0.0',
			exitCode: 0,
			stdout: ''
		}
	]);
	const depRange = require('../package.json').engines.npm;
	await t.throwsAsync(run(testedModule('2.0.0', {name: 'test', version: '1.0.0'}, {yarn: false})),
		{message: `Please upgrade to npm${depRange}`});
	t.true(SilentRenderer.tasks.some(task => task.title === 'Check npm version' && task.hasFailed()));
});

test.serial('should fail when yarn version does not match range in `package.json`', async t => {
	execaStub.createStub([
		{
			command: 'yarn --version',
			exitCode: 0,
			stdout: '1.0.0'
		},
		{
			command: 'git rev-parse --quiet --verify refs/tags/v2.0.0',
			exitCode: 0,
			stdout: ''
		}
	]);
	const depRange = require('../package.json').engines.yarn;
	await t.throwsAsync(run(testedModule('2.0.0', {name: 'test', version: '1.0.0'}, {yarn: true})),
		{message: `Please upgrade to yarn${depRange}`});
	t.true(SilentRenderer.tasks.some(task => task.title === 'Check yarn version' && task.hasFailed()));
});

test.serial('should fail when user is not authenticated at npm registry', async t => {
	execaStub.createStub([
		{
			command: 'npm whoami',
			exitCode: 0,
			stdout: 'sindresorhus'
		},
		{
			command: 'npm access ls-collaborators test',
			exitCode: 0,
			stdout: '{"sindresorhus": "read"}'
		}
	]);
	process.env.NODE_ENV = 'P';
	await t.throwsAsync(run(testedModule('2.0.0', {name: 'test', version: '1.0.0'}, {yarn: false})),
		{message: 'You do not have write permissions required to publish this package.'});
	process.env.NODE_ENV = 'test';
	t.true(SilentRenderer.tasks.some(task => task.title === 'Verify user is authenticated' && task.hasFailed()));
});

test.serial('should fail when user is not authenticated at external registry', async t => {
	execaStub.createStub([
		{
			command: 'npm whoami --registry http://my.io',
			exitCode: 0,
			stdout: 'sindresorhus'
		},
		{
			command: 'npm access ls-collaborators test --registry http://my.io',
			exitCode: 0,
			stdout: '{"sindresorhus": "read"}'
		}
	]);
	process.env.NODE_ENV = 'P';
	await t.throwsAsync(run(testedModule('2.0.0', {name: 'test', version: '1.0.0', publishConfig: {registry: 'http://my.io'}}, {yarn: false})),
		{message: 'You do not have write permissions required to publish this package.'});
	process.env.NODE_ENV = 'test';
	t.true(SilentRenderer.tasks.some(task => task.title === 'Verify user is authenticated' && task.hasFailed()));
});

test.serial('private package: should disable task `verify user is authenticated`', async t => {
	execaStub.createStub([
		{
			command: 'git rev-parse --quiet --verify refs/tags/v2.0.0',
			exitCode: 0,
			stdout: ''
		}
	]);
	process.env.NODE_ENV = 'P';
	await run(testedModule('2.0.0', {name: 'test', version: '1.0.0', private: true}, {yarn: false}));
	process.env.NODE_ENV = 'test';
	t.true(SilentRenderer.tasks.some(task => task.title === 'Verify user is authenticated' && !task.isEnabled()));
});

test.serial('should fail when git version does not match range in `package.json`', async t => {
	execaStub.createStub([
		{
			command: 'git version',
			exitCode: 0,
			stdout: 'git version 1.0.0'
		}
	]);
	const depRange = require('../package.json').engines.git;
	await t.throwsAsync(run(testedModule('2.0.0', {name: 'test', version: '1.0.0'}, {yarn: false})),
		{message: `Please upgrade to git${depRange}`});
	t.true(SilentRenderer.tasks.some(task => task.title === 'Check git version' && task.hasFailed()));
});

test.serial('should fail when git remote does not exists', async t => {
	execaStub.createStub([
		{
			command: 'git ls-remote origin HEAD',
			exitCode: 1,
			exitCodeName: 'EPERM',
			stderr: 'not found'
		}
	]);
	await t.throwsAsync(run(testedModule('2.0.0', {name: 'test', version: '1.0.0'}, {yarn: false})),
		{message: 'not found'});
	t.true(SilentRenderer.tasks.some(task => task.title === 'Check git remote' && task.hasFailed()));
});

test.serial('should fail when version is invalid', async t => {
	await t.throwsAsync(run(testedModule('DDD', {name: 'test', version: '1.0.0'}, {yarn: false})),
		{message: `Version should be either ${version.SEMVER_INCREMENTS.join(', ')}, or a valid semver version.`});
	t.true(SilentRenderer.tasks.some(task => task.title === 'Validate version' && task.hasFailed()));
});

test.serial('should fail when version is lower as latest version', async t => {
	await t.throwsAsync(run(testedModule('0.1.0', {name: 'test', version: '1.0.0'}, {yarn: false})),
		{message: 'New version `0.1.0` should be higher than current version `1.0.0`'});
	t.true(SilentRenderer.tasks.some(task => task.title === 'Validate version' && task.hasFailed()));
});

test.serial('should fail when prerelease version of public package without dist tag given', async t => {
	await t.throwsAsync(run(testedModule('2.0.0-1', {name: 'test', version: '1.0.0'}, {yarn: false})),
		{message: 'You must specify a dist-tag using --tag when publishing a pre-release version. This prevents accidentally tagging unstable versions as "latest". https://docs.npmjs.com/cli/dist-tag'});
	t.true(SilentRenderer.tasks.some(task => task.title === 'Check for pre-release version' && task.hasFailed()));
});

test.serial('should not fail when prerelease version of public package with dist tag given', async t => {
	execaStub.createStub([
		{
			command: 'git rev-parse --quiet --verify refs/tags/v2.0.0',
			stdout: ''
		}
	]);
	await t.notThrowsAsync(run(testedModule('2.0.0-1', {name: 'test', version: '1.0.0'}, {yarn: false, tag: 'pre'})));
});

test.serial('should not fail when prerelease version of private package without dist tag given', async t => {
	execaStub.createStub([
		{
			command: 'git rev-parse --quiet --verify refs/tags/v2.0.0',
			stdout: ''
		}
	]);
	await t.notThrowsAsync(run(testedModule('2.0.0-1', {name: 'test', version: '1.0.0', private: true}, {yarn: false})));
});

test.serial('should fail when git tag already exists', async t => {
	execaStub.createStub([
		{
			command: 'git rev-parse --quiet --verify refs/tags/v2.0.0',
			stdout: 'vvb'
		}
	]);
	await t.throwsAsync(run(testedModule('2.0.0', {name: 'test', version: '1.0.0'}, {yarn: false})),
		{message: 'Git tag `v2.0.0` already exists.'});
	t.true(SilentRenderer.tasks.some(task => task.title === 'Check git tag existence' && task.hasFailed()));
});

test.serial('checks should pass', async t => {
	execaStub.createStub([
		{
			command: 'git rev-parse --quiet --verify refs/tags/v2.0.0',
			stdout: ''
		}
	]);
	await t.notThrowsAsync(run(testedModule('2.0.0', {name: 'test', version: '1.0.0'}, {yarn: false})));
});
