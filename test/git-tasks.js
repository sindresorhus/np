import test from 'ava';
import execaStub from 'execa_test_double';
import mockery from 'mockery';
import {SilentRenderer} from './fixtures/listr-renderer';

let testedModule;

const run = async listr => {
	listr.setRenderer(SilentRenderer);
	await listr.run();
};

test.before(() => {
	mockery.registerMock('execa', execaStub.execa);
	mockery.enable({
		useCleanCache: true,
		warnOnReplace: false,
		warnOnUnregistered: false
	});
	testedModule = require('../source/git-tasks');
});

test.beforeEach(() => {
	execaStub.resetStub();
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

test.serial('should fail when local working tree modified', async t => {
	execaStub.createStub([
		{
			command: 'git symbolic-ref --short HEAD',
			exitCode: 0,
			stdout: 'master'
		},
		{
			command: 'git status --porcelain',
			exitCode: 0,
			stdout: 'M source/git-tasks.js'
		}
	]);
	await t.throwsAsync(run(testedModule({})), {message: 'Unclean working tree. Commit or stash changes first.'});
	t.true(SilentRenderer.tasks.some(task => task.title === 'Check local working tree' && task.hasFailed()));
});

test.serial('should fail when remote history differs', async t => {
	execaStub.createStub([
		{
			command: 'git symbolic-ref --short HEAD',
			exitCode: 0,
			stdout: 'master'
		},
		{
			command: 'git status --porcelain',
			exitCode: 0,
			stdout: ''
		},
		{
			command: 'git rev-list --count --left-only @{u}...HEAD',
			exitCode: 0,
			stdout: '1'
		}
	]);
	await t.throwsAsync(run(testedModule({})), {message: 'Remote history differs. Please pull changes.'});
	t.true(SilentRenderer.tasks.some(task => task.title === 'Check remote history' && task.hasFailed()));
});

test.serial('checks should pass when publishing from master, working tree is clean and remote history not different', async t => {
	execaStub.createStub([
		{
			command: 'git symbolic-ref --short HEAD',
			exitCode: 0,
			stdout: 'master'
		},
		{
			command: 'git status --porcelain',
			exitCode: 0,
			stdout: ''
		},
		{
			command: 'git rev-list --count --left-only @{u}...HEAD',
			exitCode: 0,
			stdout: ''
		}
	]);
	await t.notThrowsAsync(run(testedModule({})));
});
