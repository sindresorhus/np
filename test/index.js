import process from 'node:process';
import test from 'ava';
import sinon from 'sinon';
import esmock from 'esmock';
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
			runPublish: sinon.stub().returns(fakeExecaReturn()),
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
			runPublish: sinon.stub().returns(fakeExecaReturn()),
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

const fakeExecaReject = error => Object.assign(
	Promise.reject(Object.assign(new Error(error), {stdout: '', stderr: error})),
	{stdout: '', stderr: ''},
);

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
			runPublish: sinon.stub().returns(fakeExecaReject('npm ERR! publish failed')),
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
