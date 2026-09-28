import path from 'node:path';
import process from 'node:process';
import test from 'node:test';
import assert from 'node:assert/strict';
import sinon from 'sinon';
import esmock from 'esmock';
// Must come before `rxjs` so both agree on the observable symbol, as `source/index.js` does.
// eslint-disable-next-line import-x/no-unassigned-import
import 'symbol-observable';
import {of, throwError} from 'rxjs';
import {npmConfig as packageManager} from '../source/package-manager/configs.js';
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

// A `pipe` method here would make `listr` treat the result as a stream and call
// `stream.once()` on it, which a plain object does not have.
const fakeExecaReturn = () => Object.assign(
	Promise.resolve({}),
	{stdout: '', stderr: ''},
);

const fakeObservableReturn = () => of('');

const fakeObservableReject = error => throwError(() => Object.assign(new Error(error), {stdout: '', stderr: error}));

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
			runPublish: sinon.stub().returns(fakeObservableReturn()),
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
			runPublish: sinon.stub().returns(fakeObservableReturn()),
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
			runPublish: sinon.stub().returns(fakeObservableReturn()),
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
			runPublish: sinon.stub().returns(fakeObservableReject('npm ERR! publish failed')),
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

test('restores cursor after successful publish', async () => {
	const stderrWriteStub = sinon.stub().returns(true);

	/**
	@type {typeof np}
	*/
	const npMock = await esmock('../source/index.js', {
		'node:process': {
			stderr: {
				isTTY: true,
				write: stderrWriteStub,
			},
		},
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
			runPublish: sinon.stub().returns(fakeObservableReturn()),
		},
	});

	await npMock('1.0.0', {
		...defaultOptions,
		cleanup: false,
		tests: false,
		'2fa': false,
	}, npPackageResult);

	assert.ok(stderrWriteStub.calledWithExactly('\u{1B}[?25h'));
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
				return fakeObservableReturn();
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
				return fakeObservableReturn();
			}),
		},
		'../source/package-manager/index.js': {
			...(await import('../source/package-manager/index.js')),
			findLockfile: sinon.stub().returns(undefined),
		},
	});

	await npMock('1.0.0', defaultOptions, {package_: npPackageResult.package_, rootDirectory});

	assert.ok(deleteAsyncStub.calledOnceWithExactly(path.join(rootDirectory, 'node_modules')));
	assert.deepEqual(execaStub.firstCall.args, ['npm', ['install', '--no-package-lock', '--include=dev', '--engine-strict'], {cwd: rootDirectory}]);
	assert.deepEqual(execaStub.secondCall.args, ['npm', ['run', 'test'], {env: {CI: 'true'}, cwd: rootDirectory}]);
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

	assert.deepEqual(execaStub.firstCall.args, ['npm', ['install', '--no-package-lock', '--include=dev', '--engine-strict'], {cwd: projectDirectory}]);
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

	assert.ok(deleteAsyncStub.calledOnceWithExactly(path.join(projectDirectory, 'node_modules')));
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

	assert.deepEqual(execaStub.secondCall.args, ['npm', ['run', 'test'], {env: {CI: 'true'}, cwd: projectDirectory}]);
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

	assert.deepEqual(execaStub.firstCall.args, ['npm', ['ci', '--engine-strict'], {cwd: npPackageResult.rootDirectory}]);
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
	assert.deepEqual(execaStub.firstCall.args, ['npm', ['ci', '--engine-strict'], {cwd: projectDirectory}]);
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
				return fakeObservableReturn();
			}),
		},
		'../source/package-manager/index.js': {
			...(await import('../source/package-manager/index.js')),
			findLockfile: sinon.stub().returns(undefined),
		},
	});

	await npMock('1.0.0', defaultOptions, {package_: npPackageResult.package_, projectDirectory, rootDirectory});

	assert.ok(deleteAsyncStub.calledOnceWithExactly(path.join(projectDirectory, 'node_modules')));
	assert.deepEqual(execaStub.firstCall.args, ['npm', ['install', '--no-package-lock', '--include=dev', '--engine-strict'], {cwd: projectDirectory}]);
	assert.deepEqual(execaStub.secondCall.args, ['npm', ['run', 'test'], {env: {CI: 'true'}, cwd: projectDirectory}]);
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
