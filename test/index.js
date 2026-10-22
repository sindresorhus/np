import path from 'node:path';
import process from 'node:process';
import test from 'node:test';
import assert from 'node:assert/strict';
import sinon from 'sinon';
import esmock from 'esmock';
import {ExitPromptError} from '@inquirer/core';
import {
	npmConfig as packageManager,
	pnpmConfig,
	bunConfig,
	yarnBerryConfig,
} from '../source/package-manager/configs.js';
import * as util from '../source/util.js';

const defaultOptions = {
	cleanup: true,
	tests: true,
	publish: true,
	packageManager,
	runPublish: true,
	availability: {
		isAvailable: false,
		isUnknown: false,
	},
	renderer: 'silent',
};

const npPackageResult = await util.readPackage();

for (const {dryRun, expectedDraftCalls} of [
	{dryRun: true, expectedDraftCalls: 0},
	{dryRun: false, expectedDraftCalls: 1},
]) {
	test(`release-draft-only respects dry-run mode: ${dryRun}`, async () => {
		const releaseTaskStub = sinon.stub().resolves();
		const npMock = await esmock('../source/index.js', {
			'../source/release-task-helper.js': releaseTaskStub,
		});

		const result = await npMock('1.0.0', {
			...defaultOptions,
			releaseDraftOnly: true,
			dryRun,
		}, npPackageResult);

		assert.equal(releaseTaskStub.callCount, expectedDraftCalls);
		assert.equal(result, npPackageResult.package_);
	});
}

test('previewing a release draft with long notes does not open a browser or change the clipboard', async () => {
	const openStub = sinon.stub().resolves();
	const clipboardWriteStub = sinon.stub().resolves();
	const generateReleaseNotesStub = sinon.stub().returns('Long release notes. '.repeat(1000));
	const npMock = await esmock('../source/index.js', {}, {
		open: openStub,
		clipboardy: {write: clipboardWriteStub},
		'../source/util.js': {
			getTagVersionPrefix: async () => 'v',
			getPreReleasePrefix: async () => '',
		},
	});

	const result = await npMock('1.0.0', {
		...defaultOptions,
		releaseDraftOnly: true,
		preview: true,
		repoUrl: 'https://github.com/example/fixture',
		releaseNotes: true,
		generateReleaseNotes: generateReleaseNotesStub,
	}, npPackageResult);

	assert.equal(result, npPackageResult.package_);
	assert.ok(openStub.notCalled);
	assert.ok(clipboardWriteStub.notCalled);
	assert.ok(generateReleaseNotesStub.notCalled);
});

const getNpMock = async () => esmock('../source/index.js', {}, {
	execa: {execa: sinon.stub().resolves({stdout: '10.0.0', stderr: ''})},
	'../source/git-util.js': {
		hasUpstream: sinon.stub().returns(true),
		pushGraceful: sinon.stub(),
		verifyWorkingTreeIsClean: sinon.stub(),
		verifyCurrentBranchIsReleaseBranch: sinon.stub(),
		verifyRemoteHistoryIsClean: sinon.stub(),
		verifyRemoteIsValid: sinon.stub(),
		verifyRecentGitVersion: sinon.stub(),
		fetch: sinon.stub(),
		verifyTagDoesNotExistOnRemote: sinon.stub(),
	},
	'../source/npm/util.js': {
		...(await import('../source/npm/util.js')),
		checkConnection: sinon.stub().resolves(),
	},
});

const npFails = (title, inputs, message) => {
	test(title, async () => {
		const npMock = await getNpMock();
		await assert.rejects(
			Promise.all(inputs.map(input => npMock(input, defaultOptions, npPackageResult))),
			{message},
		);
	});
};

npFails(
	'version is invalid',
	['foo', '4.x.3'],
	/New version (?:foo|4\.x\.3) should either be one of patch, minor, major, prepatch, preminor, premajor, prerelease, or a valid SemVer version\./v,
);

npFails(
	'version is pre-release',
	['premajor', 'preminor', 'prepatch', 'prerelease', '100.0.0-0', '100.0.0-beta'],
	'You must specify a dist-tag using --tag when publishing a pre-release version. This prevents accidentally tagging unstable versions as "latest". https://docs.npmjs.com/cli/dist-tag',
);

npFails(
	'errors on too low version',
	['1.0.0', '1.0.0-beta'],
	/New version 1\.0\.0(?:-beta)? should be higher than current version \d+\.\d+\.\d+/v,
);

// `exec` only iterates the output lines of the subprocess.
const fakeExecaReturn = () => ({
	iterable: sinon.spy(async function * () {}),
});

const fakePublishError = error => Object.assign(new Error(error), {stdout: '', stderr: error});

for (const projectDirectory of [process.cwd(), undefined]) {
	test(`returns the published package from rootDirectory ${projectDirectory ? 'with' : 'without'} projectDirectory`, async () => {
		const rootDirectory = path.resolve('dist');
		const publishedPackage = {name: 'built-package', version: '2.0.0'};
		const readPackageStub = sinon.stub().callsFake(async directory => ({
			package_: directory === rootDirectory ? publishedPackage : npPackageResult.package_,
		}));
		const npMock = await esmock('../source/index.js', {
			'../source/git-tasks.js': sinon.stub(),
			'../source/git-util.js': {hasUpstream: sinon.stub().resolves(false)},
			'../source/util.js': {readPackage: readPackageStub},
		});

		const result = await npMock('2.0.0', {
			...defaultOptions,
			runPublish: false,
			dryRun: true,
			yolo: true,
		}, {package_: {name: 'built-package', version: '1.0.0'}, rootDirectory, projectDirectory});

		assert.equal(result, publishedPackage);
		assert.ok(readPackageStub.calledOnceWithExactly(rootDirectory));
	});
}

// A renderer that logs when it gives the terminal to a task.
const createTerminalLogRenderer = log => () => ({
	pause() {
		log.push('pause');
	},
	resume() {
		log.push('resume');
	},
});

test('skip enabling 2FA if the package exists', async () => {
	const enable2faStub = sinon.stub();

	/**
	@type {typeof np}
	*/
	const npMock = await esmock('../source/index.js', {
		del: {deleteAsync: sinon.stub()},
		execa: {execa: sinon.stub().returns(fakeExecaReturn())},
		'../source/prerequisite-tasks.js': sinon.stub(),
		'../source/git-tasks.js': sinon.stub(),
		'../source/git-util.js': {
			hasUpstream: sinon.stub().returns(true),
			pushGraceful: sinon.stub(),
			verifyWorkingTreeIsClean: sinon.stub(),
		},
		'../source/npm/enable-2fa.js': enable2faStub,
		'../source/npm/publish.js': {
			getPackagePublishArguments: sinon.stub().returns([]),
			runPublish: sinon.stub().resolves({}),
		},
	});

	await assert.doesNotReject(npMock('1.0.0', {
		...defaultOptions,
		availability: {
			isAvailable: false,
			isUnknown: false,
		},
	}, npPackageResult));

	assert.ok(enable2faStub.notCalled);
});

test('skip enabling 2FA if the `2fa` option is false', async () => {
	const enable2faStub = sinon.stub();

	/**
	@type {typeof np}
	*/
	const npMock = await esmock('../source/index.js', {
		del: {deleteAsync: sinon.stub()},
		execa: {execa: sinon.stub().returns(fakeExecaReturn())},
		'../source/prerequisite-tasks.js': sinon.stub(),
		'../source/git-tasks.js': sinon.stub(),
		'../source/git-util.js': {
			hasUpstream: sinon.stub().returns(true),
			pushGraceful: sinon.stub(),
			verifyWorkingTreeIsClean: sinon.stub(),
		},
		'../source/npm/enable-2fa.js': enable2faStub,
		'../source/npm/publish.js': {
			getPackagePublishArguments: sinon.stub().returns([]),
			runPublish: sinon.stub().resolves({}),
		},
	});

	await assert.doesNotReject(npMock('1.0.0', {
		...defaultOptions,
		availability: {
			isAvailable: true,
			isUnknown: false,
		},
		'2fa': false,
	}, npPackageResult));

	assert.ok(enable2faStub.notCalled);
});

test('skip enabling 2FA in trusted publishing (OIDC) contexts', async () => {
	const enable2faStub = sinon.stub();

	/**
	@type {typeof np}
	*/
	const npMock = await esmock('../source/index.js', {
		del: {deleteAsync: sinon.stub()},
		execa: {execa: sinon.stub().returns(fakeExecaReturn())},
		'../source/prerequisite-tasks.js': sinon.stub(),
		'../source/git-tasks.js': sinon.stub(),
		'../source/git-util.js': {
			hasUpstream: sinon.stub().returns(true),
			pushGraceful: sinon.stub(),
			verifyWorkingTreeIsClean: sinon.stub(),
		},
		'../source/npm/enable-2fa.js': enable2faStub,
		'../source/npm/publish.js': {
			getPackagePublishArguments: sinon.stub().returns([]),
			runPublish: sinon.stub().resolves({}),
		},
		'../source/npm/oidc.js': {
			getOidcProvider: () => 'github',
		},
	});

	await assert.doesNotReject(npMock('1.0.0', {
		...defaultOptions,
		availability: {
			isAvailable: true,
			isUnknown: false,
		},
		'2fa': true,
	}, npPackageResult));

	assert.ok(enable2faStub.notCalled);
});

test('the OTP entered while publishing is used to enable 2FA, and the OTP handler gets a task that can take the terminal', async () => {
	const log = [];
	const enable2faStub = sinon.stub().resolves();
	const getPackagePublishArgumentsStub = sinon.stub().returns([]);
	// Like the real `runPublish`, show output in the task, so a missing `task` fails the test.
	const runPublishStub = sinon.stub().callsFake(async (_arguments, {task}) => {
		task.output = 'Publishing';

		if (runPublishStub.callCount === 1) {
			throw fakePublishError('npm error code EOTP');
		}

		return {};
	});

	/**
	@type {typeof np}
	*/
	const npMock = await esmock('../source/index.js', {
		del: {deleteAsync: sinon.stub()},
		execa: {execa: sinon.stub().returns(fakeExecaReturn())},
		'../source/prerequisite-tasks.js': sinon.stub(),
		'../source/git-tasks.js': sinon.stub(),
		'../source/git-util.js': {
			hasUpstream: sinon.stub().returns(true),
			pushGraceful: sinon.stub(),
			verifyWorkingTreeIsClean: sinon.stub(),
		},
		'../source/npm/enable-2fa.js': enable2faStub,
		async '../source/npm/handle-npm-error.js'(_error, task, executor) {
			await task.withTerminal(() => {
				log.push('otp');
			});

			return executor('123456');
		},
		'../source/npm/publish.js': {
			getPackagePublishArguments: getPackagePublishArgumentsStub,
			runPublish: runPublishStub,
		},
		'../source/npm/oidc.js': {
			getOidcProvider: () => undefined,
		},
	});

	await assert.doesNotReject(npMock('1.0.0', {
		...defaultOptions,
		availability: {
			isAvailable: true,
			isUnknown: false,
		},
		'2fa': true,
		renderer: createTerminalLogRenderer(log),
	}, npPackageResult));

	assert.deepEqual(log, ['pause', 'otp', 'resume']);
	assert.equal(runPublishStub.callCount, 2);
	assert.equal(getPackagePublishArgumentsStub.secondCall.args[0].otp, '123456');
	assert.deepEqual(enable2faStub.firstCall.args.slice(1), [npPackageResult.package_.name, {otp: '123456'}]);
});

for (const {packageManager: publishPackageManager, expectedCommand} of [
	{packageManager, expectedCommand: ['npm', ['publish', '--json']]},
	{packageManager: bunConfig, expectedCommand: ['npm', ['publish', '--json']]},
	{packageManager: pnpmConfig, expectedCommand: ['pnpm', ['publish', '--no-git-checks']]},
	{packageManager: yarnBerryConfig, expectedCommand: ['yarn', ['npm', 'publish']]},
]) {
	test(`only npm publishes with JSON output, which has the browser authentication URLs: ${publishPackageManager.id}`, async () => {
		const runPublishStub = sinon.stub().resolves({});

		/**
		@type {typeof np}
		*/
		const npMock = await esmock('../source/index.js', {
			del: {deleteAsync: sinon.stub()},
			execa: {execa: sinon.stub().returns(fakeExecaReturn())},
			'../source/prerequisite-tasks.js': sinon.stub(),
			'../source/git-tasks.js': sinon.stub(),
			'../source/git-util.js': {
				hasUpstream: sinon.stub().returns(true),
				pushGraceful: sinon.stub(),
				verifyWorkingTreeIsClean: sinon.stub(),
			},
			'../source/npm/publish.js': {
				getPackagePublishArguments: () => ['publish'],
				runPublish: runPublishStub,
			},
		});

		await npMock('1.0.0', {...defaultOptions, packageManager: publishPackageManager}, npPackageResult);

		assert.deepEqual(runPublishStub.firstCall.args[0], expectedCommand);
	});
}

test('Ctrl+C at the OTP prompt aborts without rolling back', async () => {
	const deleteTagStub = sinon.stub().resolves();
	const exitPromptError = new ExitPromptError('User force closed the prompt with SIGINT');

	/**
	@type {typeof np}
	*/
	const npMock = await esmock('../source/index.js', {
		del: {deleteAsync: sinon.stub()},
		execa: {execa: sinon.stub().returns(fakeExecaReturn())},
		'../source/prerequisite-tasks.js': sinon.stub(),
		'../source/git-tasks.js': sinon.stub(),
		'../source/git-util.js': {
			hasUpstream: sinon.stub().returns(true),
			pushGraceful: sinon.stub(),
			verifyWorkingTreeIsClean: sinon.stub(),
			latestTag: sinon.stub().resolves('v1.0.0'),
			deleteTag: deleteTagStub,
			removeLastCommit: sinon.stub().resolves(),
		},
		'../source/npm/enable-2fa.js': sinon.stub(),
		async '../source/npm/handle-npm-error.js'() {
			throw exitPromptError;
		},
		'../source/npm/publish.js': {
			getPackagePublishArguments: sinon.stub().returns([]),
			runPublish: sinon.stub().rejects(fakePublishError('npm error code EOTP')),
		},
		'../source/util.js': {
			...util,
			readPackage: sinon.stub().resolves({package_: {version: '1.0.0'}}),
			getTagVersionPrefix: sinon.stub().resolves('v'),
		},
	});

	// The CLI exits quietly on `ExitPromptError`, as it does for every other prompt.
	await assert.rejects(
		npMock('1.0.0', defaultOptions, {package_: {version: '0.9.0'}, rootDirectory: process.cwd()}),
		exitPromptError,
	);

	assert.ok(deleteTagStub.notCalled);
});

test('rollback is called when publish fails', async () => {
	const deleteTagStub = sinon.stub().resolves();
	const removeLastCommitStub = sinon.stub().resolves();

	/**
	@type {typeof np}
	*/
	const npMock = await esmock('../source/index.js', {
		del: {deleteAsync: sinon.stub()},
		execa: {execa: sinon.stub().returns(fakeExecaReturn())},
		'../source/prerequisite-tasks.js': sinon.stub(),
		'../source/git-tasks.js': sinon.stub(),
		'../source/git-util.js': {
			hasUpstream: sinon.stub().returns(true),
			pushGraceful: sinon.stub(),
			verifyWorkingTreeIsClean: sinon.stub(),
			latestTag: sinon.stub().resolves('v1.0.0'),
			deleteTag: deleteTagStub,
			removeLastCommit: removeLastCommitStub,
		},
		'../source/npm/enable-2fa.js': sinon.stub(),
		'../source/npm/publish.js': {
			getPackagePublishArguments: sinon.stub().returns([]),
			runPublish: sinon.stub().rejects(fakePublishError('npm ERR! publish failed')),
		},
		'../source/util.js': {
			...util,
			readPackage: sinon.stub().resolves({package_: {version: '1.0.0'}}),
			getTagVersionPrefix: sinon.stub().resolves('v'),
		},
	});

	await assert.rejects(
		npMock('1.0.0', {
			...defaultOptions,
		}, {package_: {version: '0.9.0'}, rootDirectory: process.cwd()}),
		{message: /Error publishing package/v},
	);

	assert.ok(deleteTagStub.calledOnce, 'deleteTag should be called once');
	assert.ok(removeLastCommitStub.calledOnce, 'removeLastCommit should be called once');
});

test('the rollback after a failed publish has the terminal, so its output is not drawn over', async () => {
	const log = [];

	/**
	@type {typeof np}
	*/
	const npMock = await esmock('../source/index.js', {
		del: {deleteAsync: sinon.stub()},
		execa: {execa: sinon.stub().returns(fakeExecaReturn())},
		'../source/prerequisite-tasks.js': sinon.stub(),
		'../source/git-tasks.js': sinon.stub(),
		'../source/git-util.js': {
			hasUpstream: sinon.stub().returns(true),
			pushGraceful: sinon.stub(),
			verifyWorkingTreeIsClean: sinon.stub(),
			latestTag: sinon.stub().resolves('v1.0.0'),
			async deleteTag() {
				log.push('deleteTag');
			},
			removeLastCommit: sinon.stub().resolves(),
		},
		'../source/npm/enable-2fa.js': sinon.stub(),
		'../source/npm/publish.js': {
			getPackagePublishArguments: sinon.stub().returns([]),
			runPublish: sinon.stub().rejects(fakePublishError('npm ERR! publish failed')),
		},
		'../source/util.js': {
			...util,
			readPackage: sinon.stub().resolves({package_: {version: '1.0.0'}}),
			getTagVersionPrefix: sinon.stub().resolves('v'),
		},
	});

	const consoleLogStub = sinon.stub(console, 'log');

	try {
		await assert.rejects(npMock('1.0.0', {
			...defaultOptions,
			renderer: createTerminalLogRenderer(log),
		}, {package_: {version: '0.9.0'}, rootDirectory: process.cwd()}));
	} finally {
		consoleLogStub.restore();
	}

	assert.deepEqual(log, ['pause', 'deleteTag', 'resume']);
});

test('the release draft task has the terminal, so its message is not drawn over', async () => {
	const log = [];
	const releaseTaskHelper = async () => {
		log.push('release');
	};

	/**
	@type {typeof np}
	*/
	const npMock = await esmock('../source/index.js', {
		del: {deleteAsync: sinon.stub()},
		execa: {execa: sinon.stub().returns(fakeExecaReturn())},
		'../source/prerequisite-tasks.js': sinon.stub(),
		'../source/git-tasks.js': sinon.stub(),
		'../source/git-util.js': {
			hasUpstream: sinon.stub().returns(true),
			pushGraceful: sinon.stub(),
			verifyWorkingTreeIsClean: sinon.stub(),
		},
		'../source/release-task-helper.js': releaseTaskHelper,
	});

	await npMock('1.0.0', {
		...defaultOptions,
		cleanup: false,
		tests: false,
		runPublish: false,
		releaseDraft: true,
		repoUrl: 'https://github.com/sindresorhus/np',
		renderer: createTerminalLogRenderer(log),
	}, npPackageResult);

	assert.deepEqual(log, ['pause', 'release', 'resume']);
});

test('a failing test command stops the release before publishing', async () => {
	const runPublishStub = sinon.stub().resolves({});
	const execaStub = sinon.stub().returns(fakeExecaReturn());
	execaStub.withArgs('npm', ['run', 'test']).returns({
		async * iterable() {
			yield 'not ok 1 - adds numbers';
			throw new Error('Command failed with exit code 1: npm run test');
		},
	});

	/**
	@type {typeof np}
	*/
	const npMock = await esmock('../source/index.js', {
		del: {deleteAsync: sinon.stub()},
		execa: {execa: execaStub},
		'../source/prerequisite-tasks.js': sinon.stub(),
		'../source/git-tasks.js': sinon.stub(),
		'../source/git-util.js': {
			hasUpstream: sinon.stub().returns(true),
			pushGraceful: sinon.stub(),
			verifyWorkingTreeIsClean: sinon.stub(),
		},
		'../source/npm/enable-2fa.js': sinon.stub(),
		'../source/npm/publish.js': {
			getPackagePublishArguments: sinon.stub().returns([]),
			runPublish: runPublishStub,
		},
	});

	await assert.rejects(
		npMock('1.0.0', {...defaultOptions, cleanup: false}, npPackageResult),
		{message: 'Command failed with exit code 1: npm run test'},
	);

	assert.ok(runPublishStub.notCalled);
});

test('the task list is cleared after success, except in a dry run', async () => {
	const npMock = await esmock('../source/index.js', {
		del: {deleteAsync: sinon.stub()},
		execa: {execa: sinon.stub().returns(fakeExecaReturn())},
		'../source/prerequisite-tasks.js': sinon.stub(),
		'../source/git-tasks.js': sinon.stub(),
		'../source/git-util.js': {
			hasUpstream: sinon.stub().returns(true),
			pushGraceful: sinon.stub(),
			verifyWorkingTreeIsClean: sinon.stub(),
		},
	});

	const getClearOnSuccess = async options => {
		let clearOnSuccess;

		await npMock('1.0.0', {
			...defaultOptions,
			runPublish: false,
			...options,
			renderer(rendererOptions) {
				({clearOnSuccess} = rendererOptions);
				return {};
			},
		}, npPackageResult);

		return clearOnSuccess;
	};

	assert.equal(await getClearOnSuccess({}), true);
	// The dry run lines must stay.
	assert.equal(await getClearOnSuccess({dryRun: true}), false);
});

test('publish error does not claim the project was rolled back when rollback fails', async () => {
	const consoleLogStub = sinon.stub(console, 'log');

	/**
	@type {typeof np}
	*/
	const npMock = await esmock('../source/index.js', {
		del: {deleteAsync: sinon.stub()},
		execa: {execa: sinon.stub().returns(fakeExecaReturn())},
		'../source/prerequisite-tasks.js': sinon.stub(),
		'../source/git-tasks.js': sinon.stub(),
		'../source/git-util.js': {
			hasUpstream: sinon.stub().returns(true),
			pushGraceful: sinon.stub(),
			verifyWorkingTreeIsClean: sinon.stub(),
			latestTag: sinon.stub().rejects(new Error('No tags found')),
		},
		'../source/npm/enable-2fa.js': sinon.stub(),
		'../source/npm/publish.js': {
			getPackagePublishArguments: sinon.stub().returns([]),
			runPublish: sinon.stub().rejects(fakePublishError('npm ERR! publish failed')),
		},
		'../source/util.js': {
			...util,
			getTagVersionPrefix: sinon.stub().resolves('v'),
		},
	});

	try {
		await assert.rejects(
			npMock('1.0.0', defaultOptions, {package_: {version: '0.9.0'}, rootDirectory: process.cwd()}),
			error => {
				assert.match(error.message, /Error publishing package/v);
				assert.doesNotMatch(error.message, /rolled back/v);
				return true;
			},
		);

		assert.ok(consoleLogStub.calledWithMatch(/Couldn't roll back because of the following error:\nError: No tags found/v));
	} finally {
		consoleLogStub.restore();
	}
});

test('publish uses rootDirectory from context as cwd', async () => {
	const contentsDirectory = path.resolve('dist');
	const projectDirectory = path.resolve('.');
	let publishCwd;

	/**
	@type {typeof np}
	*/
	const npMock = await esmock('../source/index.js', {
		del: {deleteAsync: sinon.stub()},
		execa: {execa: sinon.stub().returns(fakeExecaReturn())},
		'../source/prerequisite-tasks.js': sinon.stub(),
		'../source/git-tasks.js': sinon.stub(),
		'../source/git-util.js': {
			hasUpstream: sinon.stub().returns(true),
			pushGraceful: sinon.stub(),
			verifyWorkingTreeIsClean: sinon.stub(),
		},
		'../source/npm/enable-2fa.js': sinon.stub(),
		'../source/npm/publish.js': {
			getPackagePublishArguments: sinon.stub().returns([]),
			runPublish: sinon.stub().callsFake((_arguments, options) => {
				publishCwd = options?.cwd;
				return Promise.resolve({});
			}),
		},
	});

	await npMock('1.0.0', defaultOptions, {package_: npPackageResult.package_, projectDirectory, rootDirectory: contentsDirectory});

	assert.equal(publishCwd, contentsDirectory, 'publish should use rootDirectory from context as cwd');
});

test('rootDirectory remains the default working directory when projectDirectory is omitted', async () => {
	const rootDirectory = path.resolve('dist');
	const deleteAsyncStub = sinon.stub();
	const execaStub = sinon.stub().returns(fakeExecaReturn());
	let publishCwd;

	/**
	@type {typeof np}
	*/
	const npMock = await esmock('../source/index.js', {
		del: {deleteAsync: deleteAsyncStub},
		execa: {execa: execaStub},
		'../source/prerequisite-tasks.js': sinon.stub(),
		'../source/git-tasks.js': sinon.stub(),
		'../source/git-util.js': {
			hasUpstream: sinon.stub().returns(true),
			pushGraceful: sinon.stub(),
			verifyWorkingTreeIsClean: sinon.stub(),
		},
		'../source/npm/enable-2fa.js': sinon.stub(),
		'../source/npm/publish.js': {
			getPackagePublishArguments: sinon.stub().returns([]),
			runPublish: sinon.stub().callsFake((_arguments, options) => {
				publishCwd = options?.cwd;
				return Promise.resolve({});
			}),
		},
		'../source/package-manager/index.js': {
			...(await import('../source/package-manager/index.js')),
			findLockfile: sinon.stub().returns(undefined),
		},
	});

	await npMock('1.0.0', defaultOptions, {package_: npPackageResult.package_, rootDirectory});

	assert.ok(deleteAsyncStub.calledOnceWithExactly('node_modules', {cwd: rootDirectory}));
	assert.deepEqual(execaStub.firstCall.args, ['npm', ['install', '--no-package-lock', '--include=dev', '--engine-strict'], {cwd: rootDirectory, all: true}]);
	assert.deepEqual(execaStub.secondCall.args, ['npm', ['run', 'test'], {env: {CI: 'true'}, cwd: rootDirectory, all: true}]);
	assert.equal(publishCwd, rootDirectory);
});

test('install uses projectDirectory from context as cwd', async () => {
	const contentsDirectory = path.resolve('dist');
	const projectDirectory = path.resolve('.');
	const execaStub = sinon.stub().returns(fakeExecaReturn());

	/**
	@type {typeof np}
	*/
	const npMock = await esmock('../source/index.js', {
		del: {deleteAsync: sinon.stub()},
		execa: {execa: execaStub},
		'../source/prerequisite-tasks.js': sinon.stub(),
		'../source/git-tasks.js': sinon.stub(),
		'../source/git-util.js': {
			hasUpstream: sinon.stub().returns(true),
			pushGraceful: sinon.stub(),
			verifyWorkingTreeIsClean: sinon.stub(),
		},
	});

	await npMock('1.0.0', {
		...defaultOptions,
		tests: false,
		publish: false,
		runPublish: false,
		dryRun: false,
	}, {package_: npPackageResult.package_, projectDirectory, rootDirectory: contentsDirectory});

	assert.deepEqual(execaStub.firstCall.args, ['npm', ['install', '--no-package-lock', '--include=dev', '--engine-strict'], {cwd: projectDirectory, all: true}]);
	// The task shows the output lines of both stdout and stderr.
	assert.deepEqual(execaStub.firstCall.returnValue.iterable.firstCall.args, [{from: 'all'}]);
});

test('cleanup uses projectDirectory from context', async () => {
	const contentsDirectory = path.resolve('dist');
	const projectDirectory = path.resolve('.');
	const deleteAsyncStub = sinon.stub();

	/**
	@type {typeof np}
	*/
	const npMock = await esmock('../source/index.js', {
		del: {deleteAsync: deleteAsyncStub},
		execa: {execa: sinon.stub().returns(fakeExecaReturn())},
		'../source/prerequisite-tasks.js': sinon.stub(),
		'../source/git-tasks.js': sinon.stub(),
		'../source/git-util.js': {
			hasUpstream: sinon.stub().returns(true),
			pushGraceful: sinon.stub(),
			verifyWorkingTreeIsClean: sinon.stub(),
		},
		'../source/package-manager/index.js': {
			...(await import('../source/package-manager/index.js')),
			findLockfile: sinon.stub().returns(undefined),
		},
	});

	await npMock('1.0.0', {
		...defaultOptions,
		tests: false,
		publish: false,
		runPublish: false,
		dryRun: false,
	}, {package_: npPackageResult.package_, projectDirectory, rootDirectory: contentsDirectory});

	assert.ok(deleteAsyncStub.calledOnceWithExactly('node_modules', {cwd: projectDirectory}));
});

test('tests use projectDirectory from context as cwd', async () => {
	const contentsDirectory = path.resolve('dist');
	const projectDirectory = path.resolve('.');
	const execaStub = sinon.stub().returns(fakeExecaReturn());

	/**
	@type {typeof np}
	*/
	const npMock = await esmock('../source/index.js', {
		del: {deleteAsync: sinon.stub()},
		execa: {execa: execaStub},
		'../source/prerequisite-tasks.js': sinon.stub(),
		'../source/git-tasks.js': sinon.stub(),
		'../source/git-util.js': {
			hasUpstream: sinon.stub().returns(true),
			pushGraceful: sinon.stub(),
			verifyWorkingTreeIsClean: sinon.stub(),
		},
	});

	await npMock('1.0.0', {
		...defaultOptions,
		cleanup: false,
		publish: false,
		runPublish: false,
		dryRun: false,
	}, {package_: npPackageResult.package_, projectDirectory, rootDirectory: contentsDirectory});

	assert.deepEqual(execaStub.secondCall.args, ['npm', ['run', 'test'], {env: {CI: 'true'}, cwd: projectDirectory, all: true}]);
});

test('no-cleanup still uses lockfile-aware install command', async () => {
	const execaStub = sinon.stub().returns(fakeExecaReturn());

	/**
	@type {typeof np}
	*/
	const npMock = await esmock('../source/index.js', {
		del: {deleteAsync: sinon.stub()},
		execa: {execa: execaStub},
		'../source/prerequisite-tasks.js': sinon.stub(),
		'../source/git-tasks.js': sinon.stub(),
		'../source/git-util.js': {
			hasUpstream: sinon.stub().returns(true),
			pushGraceful: sinon.stub(),
			verifyWorkingTreeIsClean: sinon.stub(),
		},
		'../source/package-manager/index.js': {
			...(await import('../source/package-manager/index.js')),
			findLockfile: sinon.stub().returns('package-lock.json'),
		},
	});

	await npMock('1.0.0', {
		...defaultOptions,
		cleanup: false,
		tests: false,
		publish: false,
		runPublish: false,
		dryRun: false,
	}, npPackageResult);

	assert.deepEqual(execaStub.firstCall.args, ['npm', ['ci', '--include=dev', '--engine-strict'], {cwd: npPackageResult.rootDirectory, all: true}]);
});

test('contents mode looks up lockfile in projectDirectory and installs there', async () => {
	const projectDirectory = path.resolve('.');
	const rootDirectory = path.resolve('dist');
	const execaStub = sinon.stub().returns(fakeExecaReturn());
	const findLockfileStub = sinon.stub().returns('package-lock.json');

	/**
	@type {typeof np}
	*/
	const npMock = await esmock('../source/index.js', {
		del: {deleteAsync: sinon.stub()},
		execa: {execa: execaStub},
		'../source/prerequisite-tasks.js': sinon.stub(),
		'../source/git-tasks.js': sinon.stub(),
		'../source/git-util.js': {
			hasUpstream: sinon.stub().returns(true),
			pushGraceful: sinon.stub(),
			verifyWorkingTreeIsClean: sinon.stub(),
		},
		'../source/package-manager/index.js': {
			...(await import('../source/package-manager/index.js')),
			findLockfile: findLockfileStub,
		},
	});

	await npMock('1.0.0', {
		...defaultOptions,
		tests: false,
		publish: false,
		runPublish: false,
		dryRun: false,
	}, {package_: npPackageResult.package_, projectDirectory, rootDirectory});

	assert.ok(findLockfileStub.calledOnceWithExactly(projectDirectory, packageManager));
	assert.deepEqual(execaStub.firstCall.args, ['npm', ['ci', '--include=dev', '--engine-strict'], {cwd: projectDirectory, all: true}]);
});

test('contents mode keeps cleanup, install, and tests in projectDirectory while publishing from rootDirectory', async () => {
	const projectDirectory = path.resolve('.');
	const rootDirectory = path.resolve('dist');
	const deleteAsyncStub = sinon.stub();
	const execaStub = sinon.stub().returns(fakeExecaReturn());
	let publishCwd;

	/**
	@type {typeof np}
	*/
	const npMock = await esmock('../source/index.js', {
		del: {deleteAsync: deleteAsyncStub},
		execa: {execa: execaStub},
		'../source/prerequisite-tasks.js': sinon.stub(),
		'../source/git-tasks.js': sinon.stub(),
		'../source/git-util.js': {
			hasUpstream: sinon.stub().returns(true),
			pushGraceful: sinon.stub(),
			verifyWorkingTreeIsClean: sinon.stub(),
		},
		'../source/npm/enable-2fa.js': sinon.stub(),
		'../source/npm/publish.js': {
			getPackagePublishArguments: sinon.stub().returns([]),
			runPublish: sinon.stub().callsFake((_arguments, options) => {
				publishCwd = options?.cwd;
				return Promise.resolve({});
			}),
		},
		'../source/package-manager/index.js': {
			...(await import('../source/package-manager/index.js')),
			findLockfile: sinon.stub().returns(undefined),
		},
	});

	await npMock('1.0.0', defaultOptions, {package_: npPackageResult.package_, projectDirectory, rootDirectory});

	assert.ok(deleteAsyncStub.calledOnceWithExactly('node_modules', {cwd: projectDirectory}));
	assert.deepEqual(execaStub.firstCall.args, ['npm', ['install', '--no-package-lock', '--include=dev', '--engine-strict'], {cwd: projectDirectory, all: true}]);
	assert.deepEqual(execaStub.secondCall.args, ['npm', ['run', 'test'], {env: {CI: 'true'}, cwd: projectDirectory, all: true}]);
	assert.equal(publishCwd, rootDirectory);
});

test('dryRun with no-cleanup does not execute install command', async () => {
	const execaStub = sinon.stub().returns(fakeExecaReturn());
	const verifyWorkingTreeIsCleanStub = sinon.stub();

	/**
	@type {typeof np}
	*/
	const npMock = await esmock('../source/index.js', {
		del: {deleteAsync: sinon.stub()},
		execa: {execa: execaStub},
		'../source/prerequisite-tasks.js': sinon.stub(),
		'../source/git-tasks.js': sinon.stub(),
		'../source/git-util.js': {
			hasUpstream: sinon.stub().returns(true),
			pushGraceful: sinon.stub(),
			verifyWorkingTreeIsClean: verifyWorkingTreeIsCleanStub,
		},
		'../source/package-manager/index.js': {
			...(await import('../source/package-manager/index.js')),
			findLockfile: sinon.stub().returns('package-lock.json'),
		},
	});

	await npMock('1.0.0', {
		...defaultOptions,
		cleanup: false,
		tests: false,
		publish: false,
		runPublish: false,
		dryRun: true,
	}, npPackageResult);

	assert.ok(execaStub.notCalled);
	assert.ok(verifyWorkingTreeIsCleanStub.notCalled);
});

test('dryRun without lockfile does not clean up or run tests', async () => {
	const deleteAsyncStub = sinon.stub();
	const execaStub = sinon.stub().returns(fakeExecaReturn());

	/**
	@type {typeof np}
	*/
	const npMock = await esmock('../source/index.js', {
		del: {deleteAsync: deleteAsyncStub},
		execa: {execa: execaStub},
		'../source/prerequisite-tasks.js': sinon.stub(),
		'../source/git-tasks.js': sinon.stub(),
		'../source/git-util.js': {
			hasUpstream: sinon.stub().returns(true),
			pushGraceful: sinon.stub(),
			verifyWorkingTreeIsClean: sinon.stub(),
		},
		'../source/package-manager/index.js': {
			...(await import('../source/package-manager/index.js')),
			findLockfile: sinon.stub().returns(undefined),
		},
	});

	await npMock('1.0.0', {
		...defaultOptions,
		dryRun: true,
		publish: false,
		runPublish: false,
	}, npPackageResult);

	assert.ok(deleteAsyncStub.notCalled);
	assert.ok(execaStub.notCalled);
});

test('preview option remains a supported alias for dryRun', async () => {
	const deleteAsyncStub = sinon.stub();
	const execaStub = sinon.stub().returns(fakeExecaReturn());

	/**
	@type {typeof np}
	*/
	const npMock = await esmock('../source/index.js', {
		del: {deleteAsync: deleteAsyncStub},
		execa: {execa: execaStub},
		'../source/prerequisite-tasks.js': sinon.stub(),
		'../source/git-tasks.js': sinon.stub(),
		'../source/git-util.js': {
			hasUpstream: sinon.stub().returns(true),
			pushGraceful: sinon.stub(),
			verifyWorkingTreeIsClean: sinon.stub(),
		},
		'../source/package-manager/index.js': {
			...(await import('../source/package-manager/index.js')),
			findLockfile: sinon.stub().returns(undefined),
		},
	});

	await npMock('1.0.0', {
		...defaultOptions,
		preview: true,
		publish: false,
		runPublish: false,
	}, npPackageResult);

	assert.ok(deleteAsyncStub.notCalled);
	assert.ok(execaStub.notCalled);
});
