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
			command: 'git symbolic-ref --short HEAD',
			exitCode: 0,
			stdout: 'master'
		},
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

test.serial('should fail when release branch is not specified, current branch is not main/master and publishing from any branch not permitted', async t => {
	execaStub.createStub([
		{
			command: 'git symbolic-ref --short HEAD',
			exitCode: 0,
			stdout: 'feature'
		}
	]);
	await t.throwsAsync(run(testedModule({})),
		{message: 'Not on `main`/`master` branch. Use --any-branch to publish anyway, or set a different release branch using --branch.'});
	t.true(SilentRenderer.tasks.some(task => task.title === 'Check current branch' && task.hasFailed()));
});

test.serial('should fail when current branch is not the specified release branch and publishing from any branch not permitted', async t => {
	execaStub.createStub([
		{
			command: 'git symbolic-ref --short HEAD',
			exitCode: 0,
			stdout: 'feature'
		}
	]);
	await t.throwsAsync(run(testedModule({branch: 'release'})),
		{message: 'Not on `release` branch. Use --any-branch to publish anyway, or set a different release branch using --branch.'});
	t.true(SilentRenderer.tasks.some(task => task.title === 'Check current branch' && task.hasFailed()));
});

test.serial('should not fail when current branch not master and publishing from any branch permitted', async t => {
	execaStub.createStub([
		{
			command: 'git symbolic-ref --short HEAD',
			exitCode: 0,
			stdout: 'feature'
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
	await run(testedModule({anyBranch: true}));
	t.false(SilentRenderer.tasks.some(task => task.title === 'Check current branch'));
});

test.serial('should fail when git version does not match range in `package.json`', async t => {
	execaStub.createStub([
		{
			command: 'git symbolic-ref --short HEAD',
			exitCode: 0,
			stdout: 'master'
		},
		{
			command: 'git version',
			exitCode: 0,
			stdout: 'git version 1.0.0'
		}
	]);
	const depRange = require('../package.json').engines.git;
	await t.throwsAsync(run(testedModule({})),
		{message: `Please upgrade to git${depRange}`});
	t.true(SilentRenderer.tasks.some(task => task.title === 'Check git version' && task.hasFailed()));
});
