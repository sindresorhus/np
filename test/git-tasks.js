import test from 'ava';
import execaStub from 'execa_test_double';
import mockery from 'mockery';
import {tasks, SilentRenderer} from './fixtures/listr-renderer';

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

test.serial('should fail when current branch not master and publishing from any branch not permitted', async t => {
	execaStub.createStub([
		{
			command: 'git symbolic-ref --short HEAD',
			exitCode: 0,
			stdout: 'feature'
		}
	]);
	await t.throwsAsync(run(testedModule({})),
		{message: 'Not on `master` branch. Use --any-branch to publish anyway.'});
	t.true(tasks.some(task => task.title === 'Check current branch' && task.hasFailed()));
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
	t.false(tasks.some(task => task.title === 'Check current branch'));
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
	t.true(tasks.some(task => task.title === 'Check local working tree' && task.hasFailed()));
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
	t.true(tasks.some(task => task.title === 'Check remote history' && task.hasFailed()));
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
	await run(testedModule({}));
	t.pass();
});
