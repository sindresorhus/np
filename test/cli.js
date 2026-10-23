import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs/promises';
import process from 'node:process';
import test from 'node:test';
import assert from 'node:assert/strict';
import sinon from 'sinon';
import esmock from 'esmock';
import {execa} from 'execa';
import {ExitPromptError} from '@inquirer/core';
import {npPackage, npRootDirectory as rootDirectory, readPackage} from '../source/util.js';
import {getOidcProvider} from '../source/npm/oidc.js';
import {npmConfig, yarnBerryConfig} from '../source/package-manager/configs.js';
import {cliPasses} from './_helpers/verify-cli.js';

const cli = path.resolve(rootDirectory, 'source', 'cli-implementation.js');

cliPasses('flags: --help', cli, '--help', [
	'',
	'A better `npm publish`',
	'',
	'Usage',
	'$ np <version>',
	'',
	'Version can be:',
	'patch | minor | major | prepatch | preminor | premajor | prerelease | 1.2.3',
	'',
	'Commands',
	'release-draft          Open a prefilled GitHub release form for the latest Git tag',
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
	'--no-release-notes     Skips generating release notes when opening a GitHub release draft',
	'--test-script          Name of npm run script to run tests before publishing (default: test)',
	'--no-2fa               Don\'t enable 2FA on new packages (not recommended)',
	'--message              Version bump commit message, \'%s\' will be replaced with version (default: \'%s\' with npm and \'v%s\' with yarn)',
	'--package-manager      Use a specific package manager (default: package.json packageManager/devEngines)',
	'--provenance           Publish with npm provenance statements (CI-only)',
	'--remote               Git remote to push to (default: origin)',
	'--stage                Stage the publish for later approval (npm and pnpm only)',
	'',
	'Examples',
	'$ np',
	'$ np patch',
	'$ np 1.0.2',
	'$ np 1.0.2-beta.3 --tag=beta',
	'$ np 1.0.2-beta.3 --tag=beta --contents=dist',
	'$ np release-draft',
	'',
]);

cliPasses('flags: --version', cli, '--version', [npPackage.version]);

test('flags: --dry-run is shown in help', async () => {
	const {stdout} = await execa(cli, ['--help']);

	assert.ok(stdout.includes('--dry-run              Show tasks without actually executing them'));
});

for (const arguments_ of [['release-draft', '--help'], ['--help', 'release-draft'], ['patch', '--help']]) {
	test(`flags: ${arguments_.join(' ')} shows help before loading project configuration`, async t => {
		await fs.mkdir('.ai-temporary', {recursive: true});
		const temporaryDirectory = await fs.mkdtemp(path.resolve('.ai-temporary', 'release-draft-help-'));
		t.after(() => fs.rm(temporaryDirectory, {recursive: true}));
		await fs.writeFile(path.join(temporaryDirectory, 'package.json'), JSON.stringify({name: 'fixture', version: '1.0.0', np: {releaseDraftOnly: true}}));

		const {exitCode, stdout, stderr} = await execa(cli, arguments_, {cwd: temporaryDirectory, reject: false, timeout: 10_000});

		assert.equal(exitCode, 0, stderr);
		assert.match(stdout, /Usage/v);
		assert.match(stdout, /release-draft +Open a prefilled GitHub release form/v);
		assert.doesNotMatch(stdout, /Create a release draft on GitHub|Publish a new version/v);
		assert.equal(stderr, '');
	});
}

test('flags: release-draft --version shows the version without running the command', async () => {
	const {exitCode, stdout, stderr} = await execa(cli, ['release-draft', '--version', '--dry-run'], {cwd: os.tmpdir(), reject: false, timeout: 10_000});

	assert.equal(exitCode, 0, stderr);
	assert.equal(stdout, npPackage.version);
});

test('flags: unknown flags fail', async () => {
	const {exitCode, stderr} = await execa(cli, ['--wat'], {reject: false});

	assert.equal(exitCode, 2);
	assert.ok(stderr.includes('Unknown flag'));
	assert.ok(stderr.includes('--wat'));
});

test('flags: --preview remains an alias for --dry-run', async () => {
	const {exitCode, stderr} = await execa(cli, ['--preview', '--wat'], {reject: false});

	assert.equal(exitCode, 2);
	assert.ok(stderr.includes('Unknown flag'));
	assert.ok(stderr.includes('--wat'));
	assert.ok(!(stderr.includes('--preview')));
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
		getPreReleasePrefix: sinon.stub().resolves(''),
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
		getFilesToBePacked: sinon.stub().resolves([]),
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

for (const flag of ['--release-draft-only', '--no-release-draft-only']) {
	test(`cli explains the replacement for ${flag}`, async () => {
		const {exitCode, stderr} = await execa(cli, [flag, '--dry-run'], {reject: false, timeout: 10_000});

		assert.equal(exitCode, 1);
		assert.match(stderr, /The `--release-draft-only` flag has been replaced by `np release-draft`\./v);
		assert.doesNotMatch(stderr, /^ +at /mv);
	});
}

for (const releaseDraftOnly of [true, false]) {
	test(`cli rejects the old releaseDraftOnly configuration set to ${releaseDraftOnly} before starting a release`, async t => {
		const uiStub = sinon.stub();
		const npStub = sinon.stub();
		const gracefulExitStub = sinon.stub();
		const consoleErrorStub = t.mock.method(console, 'error', () => {});

		await loadCliImplementation({
			'../source/config.js': {default: async () => ({releaseDraftOnly})},
			'../source/ui.js': {default: uiStub},
			'../source/index.js': {default: npStub},
			'exit-hook': {gracefulExit: gracefulExitStub},
		});

		assert.ok(gracefulExitStub.calledOnceWithExactly(1));
		assert.match(consoleErrorStub.mock.calls[0].arguments[0], /np release-draft/v);
		assert.match(consoleErrorStub.mock.calls[0].arguments[0], /Remove `releaseDraftOnly` from your np config/v);
		assert.ok(uiStub.notCalled);
		assert.ok(npStub.notCalled);
	});
}

for (const {dryRun, packageManager, localConfig = {}} of [
	{dryRun: false, packageManager: npmConfig},
	{dryRun: true, packageManager: npmConfig},
	{dryRun: false, packageManager: yarnBerryConfig, localConfig: {stage: true, provenance: true}},
]) {
	test(`cli release-draft bypasses publish preparation for ${packageManager.id} with dry-run: ${dryRun}`, async t => {
		const defaultBranchStub = sinon.stub().rejects(new Error('No default branch'));
		const verifyGitTasksStub = sinon.stub();
		const availabilityStub = sinon.stub();
		const usernameStub = sinon.stub();
		const loginStub = sinon.stub();
		const packedFilesStub = sinon.stub();
		const externalRegistryStub = sinon.stub().returns(true);
		const execaStub = sinon.stub().rejects(new Error('Publish validation must not run'));
		const uiStub = sinon.stub().callsFake(async options => ({...options, confirm: true}));
		const npStub = sinon.stub().resolves({name: 'test-package', version: '1.0.0'});
		const gracefulExitStub = sinon.stub();
		const consoleLogStub = t.mock.method(console, 'log', () => {});
		const consoleErrorStub = t.mock.method(console, 'error', () => {});

		await loadCliImplementation({
			meow: {default: () => ({input: ['release-draft'], flags: {dryRun}, pkg: npPackage})},
			'../source/config.js': {default: async () => localConfig},
			'../source/package-manager/index.js': {getPackageManagerConfig: () => packageManager},
			'../source/git-util.js': {defaultBranch: defaultBranchStub},
			'../source/git-tasks.js': {verifyGitTasks: verifyGitTasksStub},
			'../source/npm/util.js': {
				isExternalRegistry: externalRegistryStub,
				isPackageNameAvailable: availabilityStub,
				getFilesToBePacked: packedFilesStub,
				username: usernameStub,
				login: loginStub,
			},
			'../source/ui.js': {default: uiStub},
			'../source/index.js': {default: npStub},
			execa: {execa: execaStub},
			'exit-hook': {gracefulExit: gracefulExitStub},
		});

		assert.ok(uiStub.calledOnce);
		assert.equal(uiStub.firstCall.firstArg.releaseDraftOnly, true);
		assert.equal(uiStub.firstCall.firstArg.runPublish, false);
		assert.equal(uiStub.firstCall.firstArg.version, '1.0.0');
		assert.ok(npStub.calledOnce);
		assert.equal(npStub.firstCall.args[0], '1.0.0');
		assert.equal(npStub.firstCall.args[1].dryRun, dryRun);
		assert.ok(defaultBranchStub.notCalled);
		assert.ok(verifyGitTasksStub.notCalled);
		assert.ok(availabilityStub.notCalled);
		assert.ok(packedFilesStub.notCalled);
		assert.ok(usernameStub.notCalled);
		assert.ok(loginStub.notCalled);
		assert.ok(externalRegistryStub.notCalled);
		assert.ok(execaStub.notCalled);
		assert.ok(gracefulExitStub.calledOnceWithExactly());
		assert.equal(consoleErrorStub.mock.callCount(), 0);
		assert.ok(consoleLogStub.mock.calls.every(call => !String(call.arguments[0]).includes('published')));
	});
}

for (const input of [[], ['patch'], ['1.2.3']]) {
	test(`cli preserves the release version input ${JSON.stringify(input)}`, async () => {
		const uiStub = sinon.stub().callsFake(async options => ({...options, confirm: false}));
		const verifyGitTasksStub = sinon.stub();

		await loadCliImplementation({
			meow: {default: () => ({input, flags: {publish: false}, pkg: npPackage})},
			'../source/git-tasks.js': {verifyGitTasks: verifyGitTasksStub},
			'../source/ui.js': {default: uiStub},
		});

		assert.ok(verifyGitTasksStub.calledOnce);
		assert.ok(uiStub.calledOnce);
		assert.equal(uiStub.firstCall.firstArg.version, input[0]);
		assert.equal(uiStub.firstCall.firstArg.releaseDraftOnly, false);
	});
}

test('cli exits quietly through the exit hooks when a prompt is canceled', async () => {
	const gracefulExitStub = sinon.stub();
	const consoleErrorStub = sinon.stub(console, 'error');

	try {
		await loadCliImplementation({
			'../source/ui.js': {default: sinon.stub().callsFake(async options => ({...options, confirm: true, version: '1.0.1'}))},
			'../source/index.js': {default: sinon.stub().rejects(new ExitPromptError('User force closed the prompt with SIGINT'))},
			'exit-hook': {
				gracefulExit: gracefulExitStub,
			},
		});
	} finally {
		consoleErrorStub.restore();
	}

	// `gracefulExit` runs np's exit hook, which prints “Aborted!”. `process.exit` would skip it.
	assert.ok(gracefulExitStub.calledOnceWithExactly(130));
	assert.ok(consoleErrorStub.notCalled);
});

test('cli runs git preflight before prompting', async () => {
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

	assert.ok(verifyGitTasksStub.calledOnceWithExactly({anyBranch: undefined, branch: 'main', remote: undefined}));
	assert.ok(uiStub.notCalled);
	assert.ok(gracefulExitStub.calledOnceWithExactly(1));

	consoleErrorStub.restore();
});

test('cli continues to the publish flow after successful git preflight', async () => {
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

	assert.ok(verifyGitTasksStub.calledOnceWithExactly({anyBranch: undefined, branch: 'main', remote: undefined}));
	assert.ok(uiStub.calledOnce);
	assert.ok(npStub.calledOnce);
	assert.ok(!('skipGitTasks' in npStub.firstCall.args[1]));
	assert.ok(gracefulExitStub.notCalled);
});

test('cli stops when the publish is not confirmed', async () => {
	const usernameStub = sinon.stub().resolves('sindresorhus');
	const npStub = sinon.stub().resolves({name: 'test-package', version: '1.0.1'});
	const gracefulExitStub = sinon.stub();

	await loadCliImplementation({
		meow: {default: sinon.stub().returns({input: ['patch'], flags: {publish: true}, pkg: npPackage})},
		'../source/npm/util.js': {
			isExternalRegistry: sinon.stub().returns(false),
			isPackageNameAvailable: sinon.stub().resolves({isAvailable: false, isUnknown: false}),
			getFilesToBePacked: sinon.stub().resolves([]),
			username: usernameStub,
			login: sinon.stub(),
		},
		'../source/index.js': {default: npStub},
		'exit-hook': {gracefulExit: gracefulExitStub},
	});

	assert.ok(gracefulExitStub.calledOnceWithExactly());
	// Only the warm-up checks the login, not the auth check before publishing.
	assert.ok(usernameStub.calledOnce);
	assert.ok(npStub.notCalled);
});

test('cli allows --any-branch in a repository without main or master', async t => {
	const defaultBranchStub = sinon.stub().rejects(new Error('Could not infer the default Git branch.'));
	const uiStub = sinon.stub().callsFake(async options => ({...options, confirm: false}));
	const gracefulExitStub = sinon.stub();
	t.mock.method(console, 'error', () => {});

	await loadCliImplementation({
		meow: {default: sinon.stub().returns({input: ['patch'], flags: {publish: false, anyBranch: true}, pkg: npPackage})},
		'../source/git-util.js': {
			defaultBranch: defaultBranchStub,
			getCurrentBranch: sinon.stub().resolves('trunk'),
		},
		'../source/ui.js': {default: uiStub},
		'exit-hook': {gracefulExit: gracefulExitStub},
	});

	assert.ok(uiStub.calledOnce);
	assert.equal(uiStub.firstCall.args[0].branch, 'HEAD');
	assert.ok(defaultBranchStub.notCalled);
	assert.ok(gracefulExitStub.calledOnceWithExactly());
});

test('cli respects an explicit release branch with --any-branch', async () => {
	const defaultBranchStub = sinon.stub();
	const getCurrentBranchStub = sinon.stub();
	const uiStub = sinon.stub().callsFake(async options => ({...options, confirm: false}));

	await loadCliImplementation({
		meow: {default: sinon.stub().returns({input: ['patch'], flags: {publish: false, anyBranch: true, branch: 'release'}, pkg: npPackage})},
		'../source/git-util.js': {defaultBranch: defaultBranchStub, getCurrentBranch: getCurrentBranchStub},
		'../source/ui.js': {default: uiStub},
	});

	assert.equal(uiStub.firstCall.args[0].branch, 'release');
	assert.ok(defaultBranchStub.notCalled);
	assert.ok(getCurrentBranchStub.notCalled);
});

test('cli allows --any-branch on a detached HEAD', async () => {
	const defaultBranchStub = sinon.stub();
	const getCurrentBranchStub = sinon.stub().rejects(new Error('fatal: ref HEAD is not a symbolic ref'));
	const uiStub = sinon.stub().callsFake(async options => ({...options, confirm: false}));

	await loadCliImplementation({
		meow: {default: sinon.stub().returns({input: ['patch'], flags: {publish: false, anyBranch: true}, pkg: npPackage})},
		'../source/git-util.js': {defaultBranch: defaultBranchStub, getCurrentBranch: getCurrentBranchStub},
		'../source/ui.js': {default: uiStub},
	});

	assert.equal(uiStub.firstCall.args[0].branch, 'HEAD');
	assert.ok(defaultBranchStub.notCalled);
	assert.ok(getCurrentBranchStub.notCalled);
});

test('cli does not print that the package was published after a dry run', async () => {
	const gracefulExitStub = sinon.stub();
	const consoleLogStub = sinon.stub(console, 'log');

	try {
		await loadCliImplementation({
			'../source/ui.js': {
				default: sinon.stub().callsFake(async options => ({
					...options, confirm: true, dryRun: true, version: '1.0.1',
				})),
			},
			'exit-hook': {gracefulExit: gracefulExitStub},
		});
	} finally {
		consoleLogStub.restore();
	}

	assert.ok(gracefulExitStub.calledOnceWithExactly());
	assert.ok(consoleLogStub.args.flat().every(argument => !String(argument).includes('published')));
});

test('cli does not log in to npm when previewing a release', async t => {
	const usernameStub = sinon.stub().rejects(Object.assign(new Error('You must be logged in.'), {isNotLoggedIn: true}));
	usernameStub.onThirdCall().resolves('sindresorhus');
	const loginStub = sinon.stub().resolves();
	const npStub = sinon.stub().resolves({name: 'test-package', version: '1.0.1'});
	const gracefulExitStub = sinon.stub();
	t.mock.method(console, 'log', () => {});
	t.mock.method(console, 'error', () => {});

	await loadCliImplementation({
		meow: {default: sinon.stub().returns({input: ['patch'], flags: {publish: true, dryRun: true}, pkg: npPackage})},
		'is-interactive': {default: () => true},
		'../source/npm/util.js': {
			isExternalRegistry: () => false,
			isPackageNameAvailable: async () => ({isAvailable: false, isUnknown: false}),
			getFilesToBePacked: async () => [],
			username: usernameStub,
			login: loginStub,
		},
		'../source/ui.js': {default: async options => ({...options, confirm: true, version: '1.0.1'})},
		'../source/index.js': {default: npStub},
		'exit-hook': {gracefulExit: gracefulExitStub},
	});

	assert.ok(npStub.calledOnce);
	assert.equal(npStub.firstCall.args[1].dryRun, true);
	assert.ok(gracefulExitStub.calledOnceWithExactly());
	assert.ok(loginStub.notCalled, 'Previewing a release must not change npm credentials.');
});

const rejectsStagedPublishing = (title, {id, version, minimumVersion}) => {
	test(title, async () => {
		const gracefulExitStub = sinon.stub();
		const consoleErrorStub = sinon.stub(console, 'error');
		const uiStub = sinon.stub();
		const npStub = sinon.stub();
		const execaStub = sinon.stub().resolves({stdout: version});

		try {
			await loadCliImplementation({
				meow: {default: sinon.stub().returns({input: ['patch'], flags: {publish: true, stage: true}, pkg: npPackage})},
				'../source/package-manager/index.js': {
					getPackageManagerConfig: sinon.stub().returns({id, cli: id}),
				},
				'../source/npm/util.js': {
					isExternalRegistry: sinon.stub().returns(false),
					isPackageNameAvailable: sinon.stub().resolves({isAvailable: false, isUnknown: false}),
					getFilesToBePacked: sinon.stub().resolves([]),
					username: sinon.stub(),
					login: sinon.stub(),
				},
				'../source/ui.js': {default: uiStub},
				'../source/index.js': {default: npStub},
				execa: {execa: execaStub},
				'exit-hook': {gracefulExit: gracefulExitStub},
			});
		} finally {
			consoleErrorStub.restore();
		}

		assert.ok(gracefulExitStub.calledOnceWithExactly(1));
		assert.ok(consoleErrorStub.firstCall.firstArg.includes(`Staged publishing requires ${id} >=${minimumVersion}`));
		assert.ok(execaStub.calledOnceWithExactly(id, ['--version']));
		assert.ok(!(uiStub.called));
		assert.ok(!(npStub.called));
	});
};

rejectsStagedPublishing(
	'cli rejects npm staged publishing before the publish flow',
	{id: 'npm', version: '10.0.0', minimumVersion: '11.15.0'},
);
rejectsStagedPublishing(
	'cli rejects pnpm staged publishing before the publish flow',
	{id: 'pnpm', version: '11.2.0', minimumVersion: '11.3.0'},
);

const acceptsStagedPublishing = (title, {id, version}) => {
	test(title, async () => {
		const gracefulExitStub = sinon.stub();
		const consoleErrorStub = sinon.stub(console, 'error');
		const consoleLogStub = sinon.stub(console, 'log');
		const uiStub = sinon.stub().callsFake(async options => ({...options, confirm: false, version: '1.0.1'}));
		const npStub = sinon.stub().resolves({name: 'test-package', version: '1.0.1'});
		const execaStub = sinon.stub().resolves({stdout: version});

		try {
			await loadCliImplementation({
				meow: {default: sinon.stub().returns({input: ['patch'], flags: {publish: false, stage: true}, pkg: npPackage})},
				'../source/package-manager/index.js': {
					getPackageManagerConfig: sinon.stub().returns({id, cli: id}),
				},
				'../source/ui.js': {default: uiStub},
				'../source/index.js': {default: npStub},
				execa: {execa: execaStub},
				'exit-hook': {gracefulExit: gracefulExitStub},
			});
		} finally {
			consoleErrorStub.restore();
			consoleLogStub.restore();
		}

		assert.ok(!(consoleErrorStub.called));
		assert.ok(gracefulExitStub.calledOnceWithExactly());
		assert.ok(uiStub.calledOnce);
		// The publish was not confirmed.
		assert.ok(npStub.notCalled);
		assert.ok(execaStub.calledOnceWithExactly(id, ['--version']));
	});
};

acceptsStagedPublishing(
	'cli accepts npm staged publishing at the minimum version',
	{id: 'npm', version: '11.15.0'},
);
acceptsStagedPublishing(
	'cli accepts pnpm staged publishing at the minimum version',
	{id: 'pnpm', version: '11.3.0'},
);

const notLoggedInError = () => Object.assign(new Error('You must be logged in. Use `npm login` and try again.'), {isNotLoggedIn: true});

for (const hasOidcToken of [true, false]) {
	test(`cli allows CircleCI publishing without npm login only with an OIDC token: ${hasOidcToken}`, async t => {
		t.mock.property(process, 'env', {
			...process.env, GITHUB_ACTIONS: '', GITLAB_CI: '', CIRCLECI: 'true', NPM_ID_TOKEN: hasOidcToken ? 'token' : '',
		});
		t.mock.method(console, 'log', () => {});
		t.mock.method(console, 'error', () => {});
		const usernameStub = sinon.stub().rejects(notLoggedInError());
		const loginStub = sinon.stub();
		const npStub = sinon.stub().resolves({name: 'test-package', version: '1.0.1'});
		const gracefulExitStub = sinon.stub();

		await loadCliImplementation({
			meow: {default: () => ({input: ['patch'], flags: {publish: true}, pkg: npPackage})},
			'is-interactive': {default: () => false},
			'../source/npm/oidc.js': {getOidcProvider},
			'../source/npm/util.js': {
				isExternalRegistry: () => false,
				isPackageNameAvailable: async () => ({isAvailable: false, isUnknown: false}),
				getFilesToBePacked: async () => [],
				username: usernameStub,
				login: loginStub,
			},
			'../source/ui.js': {default: async options => ({...options, confirm: true, version: '1.0.1'})},
			'../source/index.js': {default: npStub},
			'exit-hook': {gracefulExit: gracefulExitStub},
		});

		assert.equal(npStub.calledOnce, hasOidcToken);
		assert.equal(usernameStub.notCalled, hasOidcToken, 'OIDC must skip both the warm-up and the pre-publish authentication check.');
		assert.ok(loginStub.notCalled);
		assert.equal(gracefulExitStub.calledOnceWithExactly(1), !hasOidcToken);
	});
}

test('cli auto-runs `npm login` and re-verifies after a successful login', async () => {
	// The first two calls are the early warm-up and the auth check. Neither result is cached because `username` is stubbed, and the real memoized version does not cache failures either.
	const usernameStub = sinon.stub();
	usernameStub.onFirstCall().rejects(notLoggedInError());
	usernameStub.onSecondCall().rejects(notLoggedInError());
	usernameStub.onThirdCall().resolves('sindresorhus');
	const loginStub = sinon.stub().resolves();
	const npStub = sinon.stub().resolves({name: 'test-package', version: '1.0.1'});
	const gracefulExitStub = sinon.stub();
	const consoleLogStub = sinon.stub(console, 'log');

	await loadCliImplementation({
		meow: {default: sinon.stub().returns({input: ['patch'], flags: {publish: true}, pkg: npPackage})},
		'is-interactive': {default: sinon.stub().returns(true)},
		'../source/npm/util.js': {
			isExternalRegistry: sinon.stub().returns(false),
			isPackageNameAvailable: sinon.stub().resolves({isAvailable: false, isUnknown: false}),
			getFilesToBePacked: sinon.stub().resolves([]),
			username: usernameStub,
			login: loginStub,
		},
		'../source/ui.js': {default: sinon.stub().callsFake(async options => ({...options, confirm: true, version: '1.0.1'}))},
		'../source/index.js': {default: npStub},
		'exit-hook': {gracefulExit: gracefulExitStub},
	});

	assert.ok(loginStub.calledOnce);
	assert.ok(usernameStub.calledThrice);
	assert.ok(npStub.calledOnce);

	consoleLogStub.restore();
});

test('cli fails with an actionable error when still not authenticated after `npm login`', async () => {
	const usernameStub = sinon.stub().rejects(notLoggedInError());
	const loginStub = sinon.stub().resolves();
	const npStub = sinon.stub().resolves({name: 'test-package', version: '1.0.1'});
	const gracefulExitStub = sinon.stub();
	const consoleLogStub = sinon.stub(console, 'log');
	const consoleErrorStub = sinon.stub(console, 'error');

	await loadCliImplementation({
		meow: {default: sinon.stub().returns({input: ['patch'], flags: {publish: true}, pkg: npPackage})},
		'is-interactive': {default: sinon.stub().returns(true)},
		'../source/npm/util.js': {
			isExternalRegistry: sinon.stub().returns(false),
			isPackageNameAvailable: sinon.stub().resolves({isAvailable: false, isUnknown: false}),
			getFilesToBePacked: sinon.stub().resolves([]),
			username: usernameStub,
			login: loginStub,
		},
		'../source/ui.js': {default: sinon.stub().callsFake(async options => ({...options, confirm: true, version: '1.0.1'}))},
		'../source/index.js': {default: npStub},
		'exit-hook': {gracefulExit: gracefulExitStub},
	});

	assert.ok(loginStub.calledOnce);
	assert.ok(usernameStub.calledThrice);
	assert.ok(npStub.notCalled);
	assert.ok(gracefulExitStub.calledOnceWithExactly(1));
	assert.ok(consoleErrorStub.calledOnce);
	assert.ok(consoleErrorStub.firstCall.firstArg.includes('Still not authenticated after `npm login`'));

	consoleLogStub.restore();
	consoleErrorStub.restore();
});

for (const selection of ['flag', 'config']) {
	for (const childExists of [true, false]) {
		test(`cli rejects ${selection} contents without its own package.json when the directory exists: ${childExists}`, async t => {
			await fs.mkdir('.ai-temporary', {recursive: true});
			const projectDirectory = await fs.mkdtemp(path.resolve('.ai-temporary', 'contents-manifest-'));
			t.after(() => fs.rm(projectDirectory, {recursive: true}));
			await fs.writeFile(path.join(projectDirectory, 'package.json'), JSON.stringify({name: 'parent-package', version: '1.0.0'}));
			const contentsDirectory = path.join(projectDirectory, 'dist');
			if (childExists) {
				await fs.mkdir(contentsDirectory);
			}

			const uiStub = sinon.stub().callsFake(async options => ({...options, confirm: false}));
			const gracefulExitStub = sinon.stub();
			const consoleErrorStub = t.mock.method(console, 'error', () => {});

			await loadCliImplementation({
				meow: {default: () => ({input: ['patch'], flags: {publish: false, contents: selection === 'flag' ? contentsDirectory : undefined}, pkg: npPackage})},
				'../source/config.js': {default: async () => selection === 'config' ? {contents: contentsDirectory} : {}},
				'../source/util.js': {readPackage},
				'../source/ui.js': {default: uiStub},
				'exit-hook': {gracefulExit: gracefulExitStub},
			});

			assert.ok(uiStub.notCalled, 'A missing contents manifest must not silently select a parent package.');
			assert.ok(gracefulExitStub.calledOnceWithExactly(1));
			assert.match(consoleErrorStub.mock.calls[0].arguments[0], /package\.json.*contents/sv);
		});
	}
}

for (const {selection, contents, fromSubdirectory = false} of [
	{selection: 'flag', contents: 'dist'},
	{selection: 'config', contents: 'dist'},
	{selection: 'flag', contents: '.'},
	{selection: 'flag', fromSubdirectory: true},
]) {
	test(`cli selects the expected package for ${selection} contents ${JSON.stringify(contents)} from a subdirectory: ${fromSubdirectory}`, async t => {
		await fs.mkdir('.ai-temporary', {recursive: true});
		const projectDirectory = await fs.mkdtemp(path.resolve('.ai-temporary', 'contents-package-'));
		t.after(() => fs.rm(projectDirectory, {recursive: true}));
		const contentsDirectory = path.join(projectDirectory, 'dist');
		await fs.mkdir(contentsDirectory);
		await fs.mkdir(path.join(projectDirectory, 'src'));
		await fs.writeFile(path.join(projectDirectory, 'package.json'), JSON.stringify({name: 'parent-package', version: '1.0.0'}));
		await fs.writeFile(path.join(contentsDirectory, 'package.json'), JSON.stringify({name: 'child-package', version: '1.0.0'}));
		const invocationDirectory = fromSubdirectory ? path.join(projectDirectory, 'src') : projectDirectory;
		t.mock.method(process, 'cwd', () => invocationDirectory);
		const uiStub = sinon.stub().callsFake(async options => ({...options, confirm: false}));
		const gracefulExitStub = sinon.stub();

		await loadCliImplementation({
			meow: {default: () => ({input: ['patch'], flags: {publish: false, contents: selection === 'flag' ? contents : undefined}, pkg: npPackage})},
			'../source/config.js': {default: async () => selection === 'config' ? {contents} : {}},
			'../source/util.js': {readPackage},
			'../source/ui.js': {default: uiStub},
			'exit-hook': {gracefulExit: gracefulExitStub},
		});

		assert.ok(uiStub.calledOnce);
		assert.equal(uiStub.firstCall.args[1].package_.name, contents === 'dist' ? 'child-package' : 'parent-package');
		assert.equal(uiStub.firstCall.args[1].rootDirectory, contents === 'dist' ? contentsDirectory : projectDirectory);
		assert.ok(gracefulExitStub.calledOnceWithExactly());
	});
}
