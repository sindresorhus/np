import path from 'node:path';
import process from 'node:process';
import test from 'ava';
import sinon from 'sinon';
import esmock from 'esmock';
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
		...await import('../source/npm/util.js'),
		checkConnection: sinon.stub().resolves(),
	},
});

const npFails = test.macro(async (t, inputs, message) => {
	const npMock = await getNpMock();
	await t.throwsAsync(
		Promise.all(inputs.map(input => npMock(input, defaultOptions, npPackageResult))),
		{message},
	);
});

test('version is invalid', npFails, ['foo', '4.x.3'], /New version (?:foo|4\.x\.3) should either be one of patch, minor, major, prepatch, preminor, premajor, prerelease, or a valid SemVer version\./);

test('version is pre-release', npFails, ['premajor', 'preminor', 'prepatch', 'prerelease', '100.0.0-0', '100.0.0-beta'], 'You must specify a dist-tag using --tag when publishing a pre-release version. This prevents accidentally tagging unstable versions as "latest". https://docs.npmjs.com/cli/dist-tag');

test('errors on too low version', npFails, ['1.0.0', '1.0.0-beta'], /New version 1\.0\.0(?:-beta)? should be higher than current version \d+\.\d+\.\d+/);

const fakeExecaReturn = () => Object.assign(
	Promise.resolve({pipe: sinon.stub()}),
	{stdout: '', stderr: ''},
);

const fakeObservableReturn = () => of('');

const fakeObservableReject = error => throwError(() => Object.assign(new Error(error), {stdout: '', stderr: error}));

test('skip enabling 2FA if the package exists', async t => {
	const enable2faStub = sinon.stub();

	/** @type {typeof np} */
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

	await t.notThrowsAsync(npMock('1.0.0', {
		...defaultOptions,
		availability: {
			isAvailable: false,
			isUnknown: false,
		},
	}, npPackageResult));

	t.true(enable2faStub.notCalled);
});

test('skip enabling 2FA if the `2fa` option is false', async t => {
	const enable2faStub = sinon.stub();

	/** @type {typeof np} */
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

	await t.notThrowsAsync(npMock('1.0.0', {
		...defaultOptions,
		availability: {
			isAvailable: true,
			isUnknown: false,
		},
		'2fa': false,
	}, npPackageResult));

	t.true(enable2faStub.notCalled);
});

test('skip enabling 2FA in trusted publishing (OIDC) contexts', async t => {
	const enable2faStub = sinon.stub();

	/** @type {typeof np} */
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

	await t.notThrowsAsync(npMock('1.0.0', {
		...defaultOptions,
		availability: {
			isAvailable: true,
			isUnknown: false,
		},
		'2fa': true,
	}, npPackageResult));

	t.true(enable2faStub.notCalled);
});

test('rollback is called when publish fails', async t => {
	const deleteTagStub = sinon.stub().resolves();
	const removeLastCommitStub = sinon.stub().resolves();

	/** @type {typeof np} */
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
			readPackage: sinon.stub().resolves({version: '1.0.0'}),
			getTagVersionPrefix: sinon.stub().resolves('v'),
		},
	});

	await t.throwsAsync(
		npMock('1.0.0', {
			...defaultOptions,
		}, {package_: {version: '0.9.0'}, rootDirectory: process.cwd()}),
		{message: /Error publishing package/},
	);

	t.true(deleteTagStub.calledOnce, 'deleteTag should be called once');
	t.true(removeLastCommitStub.calledOnce, 'removeLastCommit should be called once');
});

test('publish uses rootDirectory from context as cwd', async t => {
	const contentsDirectory = path.resolve('dist');
	const projectDirectory = path.resolve('.');
	let publishCwd;

	/** @type {typeof np} */
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

	t.is(publishCwd, contentsDirectory, 'publish should use rootDirectory from context as cwd');
});

test('rootDirectory remains the default working directory when projectDirectory is omitted', async t => {
	const rootDirectory = path.resolve('dist');
	const deleteAsyncStub = sinon.stub();
	const execaStub = sinon.stub().returns(fakeExecaReturn());
	let publishCwd;

	/** @type {typeof np} */
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
			...await import('../source/package-manager/index.js'),
			findLockfile: sinon.stub().returns(undefined),
		},
	});

	await npMock('1.0.0', defaultOptions, {package_: npPackageResult.package_, rootDirectory});

	t.true(deleteAsyncStub.calledOnceWithExactly(path.join(rootDirectory, 'node_modules')));
	t.deepEqual(execaStub.firstCall.args, ['npm', ['install', '--no-package-lock', '--no-production', '--engine-strict'], {cwd: rootDirectory}]);
	t.deepEqual(execaStub.secondCall.args, ['npm', ['run', 'test'], {env: {CI: 'true'}, cwd: rootDirectory}]);
	t.is(publishCwd, rootDirectory);
});

test('install uses projectDirectory from context as cwd', async t => {
	const contentsDirectory = path.resolve('dist');
	const projectDirectory = path.resolve('.');
	const execaStub = sinon.stub().returns(fakeExecaReturn());

	/** @type {typeof np} */
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
		preview: false,
	}, {package_: npPackageResult.package_, projectDirectory, rootDirectory: contentsDirectory});

	t.deepEqual(execaStub.firstCall.args, ['npm', ['install', '--no-package-lock', '--no-production', '--engine-strict'], {cwd: projectDirectory}]);
});

test('cleanup uses projectDirectory from context', async t => {
	const contentsDirectory = path.resolve('dist');
	const projectDirectory = path.resolve('.');
	const deleteAsyncStub = sinon.stub();

	/** @type {typeof np} */
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
			...await import('../source/package-manager/index.js'),
			findLockfile: sinon.stub().returns(undefined),
		},
	});

	await npMock('1.0.0', {
		...defaultOptions,
		tests: false,
		publish: false,
		runPublish: false,
		preview: false,
	}, {package_: npPackageResult.package_, projectDirectory, rootDirectory: contentsDirectory});

	t.true(deleteAsyncStub.calledOnceWithExactly(path.join(projectDirectory, 'node_modules')));
});

test('tests use projectDirectory from context as cwd', async t => {
	const contentsDirectory = path.resolve('dist');
	const projectDirectory = path.resolve('.');
	const execaStub = sinon.stub().returns(fakeExecaReturn());

	/** @type {typeof np} */
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
		preview: false,
	}, {package_: npPackageResult.package_, projectDirectory, rootDirectory: contentsDirectory});

	t.deepEqual(execaStub.secondCall.args, ['npm', ['run', 'test'], {env: {CI: 'true'}, cwd: projectDirectory}]);
});

test('no-cleanup still uses lockfile-aware install command', async t => {
	const execaStub = sinon.stub().returns(fakeExecaReturn());

	/** @type {typeof np} */
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
			...await import('../source/package-manager/index.js'),
			findLockfile: sinon.stub().returns('package-lock.json'),
		},
	});

	await npMock('1.0.0', {
		...defaultOptions,
		cleanup: false,
		tests: false,
		publish: false,
		runPublish: false,
		preview: false,
	}, npPackageResult);

	t.deepEqual(execaStub.firstCall.args, ['npm', ['ci', '--engine-strict'], {cwd: npPackageResult.rootDirectory}]);
});

test('contents mode looks up lockfile in projectDirectory and installs there', async t => {
	const projectDirectory = path.resolve('.');
	const rootDirectory = path.resolve('dist');
	const execaStub = sinon.stub().returns(fakeExecaReturn());
	const findLockfileStub = sinon.stub().returns('package-lock.json');

	/** @type {typeof np} */
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
			...await import('../source/package-manager/index.js'),
			findLockfile: findLockfileStub,
		},
	});

	await npMock('1.0.0', {
		...defaultOptions,
		tests: false,
		publish: false,
		runPublish: false,
		preview: false,
	}, {package_: npPackageResult.package_, projectDirectory, rootDirectory});

	t.true(findLockfileStub.calledOnceWithExactly(projectDirectory, packageManager));
	t.deepEqual(execaStub.firstCall.args, ['npm', ['ci', '--engine-strict'], {cwd: projectDirectory}]);
});

test('contents mode keeps cleanup, install, and tests in projectDirectory while publishing from rootDirectory', async t => {
	const projectDirectory = path.resolve('.');
	const rootDirectory = path.resolve('dist');
	const deleteAsyncStub = sinon.stub();
	const execaStub = sinon.stub().returns(fakeExecaReturn());
	let publishCwd;

	/** @type {typeof np} */
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
			...await import('../source/package-manager/index.js'),
			findLockfile: sinon.stub().returns(undefined),
		},
	});

	await npMock('1.0.0', defaultOptions, {package_: npPackageResult.package_, projectDirectory, rootDirectory});

	t.true(deleteAsyncStub.calledOnceWithExactly(path.join(projectDirectory, 'node_modules')));
	t.deepEqual(execaStub.firstCall.args, ['npm', ['install', '--no-package-lock', '--no-production', '--engine-strict'], {cwd: projectDirectory}]);
	t.deepEqual(execaStub.secondCall.args, ['npm', ['run', 'test'], {env: {CI: 'true'}, cwd: projectDirectory}]);
	t.is(publishCwd, rootDirectory);
});

test('preview with no-cleanup does not execute install command', async t => {
	const execaStub = sinon.stub().returns(fakeExecaReturn());
	const verifyWorkingTreeIsCleanStub = sinon.stub();

	/** @type {typeof np} */
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
			...await import('../source/package-manager/index.js'),
			findLockfile: sinon.stub().returns('package-lock.json'),
		},
	});

	await npMock('1.0.0', {
		...defaultOptions,
		cleanup: false,
		tests: false,
		publish: false,
		runPublish: false,
		preview: true,
	}, npPackageResult);

	t.true(execaStub.notCalled);
	t.true(verifyWorkingTreeIsCleanStub.notCalled);
});

test('preview without lockfile does not clean up or run tests', async t => {
	const deleteAsyncStub = sinon.stub();
	const execaStub = sinon.stub().returns(fakeExecaReturn());

	/** @type {typeof np} */
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
			...await import('../source/package-manager/index.js'),
			findLockfile: sinon.stub().returns(undefined),
		},
	});

	await npMock('1.0.0', {
		...defaultOptions,
		preview: true,
		publish: false,
		runPublish: false,
	}, npPackageResult);

	t.true(deleteAsyncStub.notCalled);
	t.true(execaStub.notCalled);
});
