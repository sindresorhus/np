import path from 'node:path';
import process from 'node:process';
import test from 'ava';
import sinon from 'sinon';
import esmock from 'esmock';
import {execa} from 'execa';
import {npPackage, npRootDirectory as rootDirectory} from '../source/util.js';
import {cliPasses} from './_helpers/verify-cli.js';

const cli = path.resolve(rootDirectory, 'source', 'cli-implementation.js');

test('flags: --help', cliPasses, cli, '--help', [
	'',
	'A better `npm publish`',
	'',
	'Usage',
	'$ np <version>',
	'',
	'Version can be:',
	'patch | minor | major | prepatch | preminor | premajor | prerelease | 1.2.3',
	'',
	'Options',
	'--any-branch           Allow publishing from any branch',
	'--branch               Name of the release branch (default: main | master)',
	'--no-cleanup           Skips np\'s node_modules cleanup step before install',
	'--no-tests             Skips tests',
	'--yolo                 Skips cleanup and testing',
	'--no-publish           Skips publishing',
	'--dry-run              Show tasks without actually executing them',
	'--tag                  Publish under a given dist-tag',
	'--contents             Subdirectory to publish',
	'--no-release-draft     Skips opening a GitHub release draft',
	'--release-draft-only   Only opens a GitHub release draft for the latest published version',
	'--no-release-notes     Skips generating release notes when opening a GitHub release draft',
	'--test-script          Name of npm run script to run tests before publishing (default: test)',
	'--no-2fa               Don\'t enable 2FA on new packages (not recommended)',
	'--message              Version bump commit message, \'%s\' will be replaced with version (default: \'%s\' with npm and \'v%s\' with yarn)',
	'--package-manager      Use a specific package manager (default: package.json packageManager/devEngines)',
	'--provenance           Publish with npm provenance statements (CI-only)',
	'--remote               Git remote to push to (default: origin)',
	'',
	'Examples',
	'$ np',
	'$ np patch',
	'$ np 1.0.2',
	'$ np 1.0.2-beta.3 --tag=beta',
	'$ np 1.0.2-beta.3 --tag=beta --contents=dist',
	'',
]);

test('flags: --version', cliPasses, cli, '--version', [npPackage.version]);

test('flags: --dry-run is shown in help', async t => {
	const {stdout} = await execa(cli, ['--help']);

	t.true(stdout.includes('--dry-run              Show tasks without actually executing them'));
});

test('flags: unknown flags fail', async t => {
	const {exitCode, stderr} = await execa(cli, ['--wat'], {reject: false});

	t.is(exitCode, 2);
	t.true(stderr.includes('Unknown flag'));
	t.true(stderr.includes('--wat'));
});

test('flags: --preview remains an alias for --dry-run', async t => {
	const {exitCode, stderr} = await execa(cli, ['--preview', '--wat'], {reject: false});

	t.is(exitCode, 2);
	t.true(stderr.includes('Unknown flag'));
	t.true(stderr.includes('--wat'));
	t.false(stderr.includes('--preview'));
});

const loadCliImplementation = async overrides => esmock('../source/cli-implementation.js', {}, {
	meow: {
		default: sinon.stub().returns({
			input: ['patch'],
			flags: {
				publish: false,
			},
			pkg: npPackage,
		}),
	},
	'update-notifier': {default: sinon.stub().returns({notify: sinon.stub()})},
	'../source/config.js': {default: sinon.stub().resolves({})},
	'../source/util.js': {
		readPackage: sinon.stub().resolves({
			package_: {
				name: 'test-package',
				version: '1.0.0',
			},
			rootDirectory: process.cwd(),
		}),
	},
	'../source/git-util.js': {
		defaultBranch: sinon.stub().resolves('main'),
	},
	'../source/git-tasks.js': {
		verifyGitTasks: sinon.stub().resolves(),
	},
	'../source/package-manager/index.js': {
		getPackageManagerConfig: sinon.stub().returns({
			id: 'npm',
			cli: 'npm',
		}),
	},
	'../source/npm/util.js': {
		isExternalRegistry: sinon.stub().returns(false),
		isPackageNameAvailable: sinon.stub(),
		username: sinon.stub(),
		login: sinon.stub(),
	},
	'../source/npm/oidc.js': {
		getOidcProvider: sinon.stub().returns(undefined),
	},
	'../source/ui.js': {default: sinon.stub().callsFake(async options => ({...options, confirm: false, version: '1.0.1'}))},
	'../source/index.js': {default: sinon.stub().resolves({name: 'test-package', version: '1.0.1'})},
	'exit-hook': {
		gracefulExit: sinon.stub(),
	},
	...overrides,
});

test.serial('cli runs git preflight before prompting', async t => {
	const verifyGitTasksStub = sinon.stub().rejects(new Error('Not on `main` branch.'));
	const uiStub = sinon.stub().callsFake(async options => ({...options, confirm: true, version: '1.0.1'}));
	const gracefulExitStub = sinon.stub();
	const consoleErrorStub = sinon.stub(console, 'error');

	await loadCliImplementation({
		'../source/git-tasks.js': {
			verifyGitTasks: verifyGitTasksStub,
		},
		'../source/ui.js': {default: uiStub},
		'exit-hook': {
			gracefulExit: gracefulExitStub,
		},
	});

	t.true(verifyGitTasksStub.calledOnceWithExactly({anyBranch: undefined, branch: 'main', remote: undefined}));
	t.true(uiStub.notCalled);
	t.true(gracefulExitStub.calledOnceWithExactly(1));

	consoleErrorStub.restore();
});

test.serial('cli continues to the publish flow after successful git preflight', async t => {
	const verifyGitTasksStub = sinon.stub().resolves();
	const uiStub = sinon.stub().callsFake(async options => ({...options, confirm: true, version: '1.0.1'}));
	const npStub = sinon.stub().resolves({name: 'test-package', version: '1.0.1'});
	const gracefulExitStub = sinon.stub();

	await loadCliImplementation({
		'../source/git-tasks.js': {
			verifyGitTasks: verifyGitTasksStub,
		},
		'../source/ui.js': {default: uiStub},
		'../source/index.js': {default: npStub},
		'exit-hook': {
			gracefulExit: gracefulExitStub,
		},
	});

	t.true(verifyGitTasksStub.calledOnceWithExactly({anyBranch: undefined, branch: 'main', remote: undefined}));
	t.true(uiStub.calledOnce);
	t.true(npStub.calledOnce);
	t.false('skipGitTasks' in npStub.firstCall.args[1]);
	t.true(gracefulExitStub.notCalled);
});
