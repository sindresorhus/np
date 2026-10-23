import test from 'node:test';
import assert from 'node:assert/strict';
import esmock from 'esmock';
import {npPackage} from '../source/util.js';
import {
	npmConfig,
	pnpmConfig,
	yarnConfig,
	yarnBerryConfig,
	bunConfig,
} from '../source/package-manager/configs.js';

for (const {packageManager, version, provenance = true, publish = true, shouldReject = false} of [
	{packageManager: yarnConfig, version: '1.22.22', shouldReject: true},
	{packageManager: yarnBerryConfig, version: '2.4.0', shouldReject: true},
	{packageManager: yarnBerryConfig, version: '4.8.1', shouldReject: true},
	{packageManager: yarnBerryConfig, version: 'invalid', shouldReject: true},
	{packageManager: yarnBerryConfig, version: '4.9.0'},
	{packageManager: yarnBerryConfig, version: '4.10.3'},
	{packageManager: yarnConfig, version: '1.22.22', provenance: false},
	{packageManager: yarnConfig, version: '1.22.22', publish: false},
	{packageManager: npmConfig, version: '12.2.0'},
	{packageManager: pnpmConfig, version: '11.3.0'},
	{packageManager: bunConfig, version: '1.3.0'},
]) {
	test(`provenance support for ${packageManager.id} ${version}, provenance ${provenance}, publish ${publish}`, async t => {
		let isPrompted = false;
		let isReleased = false;
		let exitCode;
		let reportedError;
		t.mock.method(console, 'error', message => {
			reportedError = message;
		});
		t.mock.method(console, 'log', () => {});
		await esmock('../source/cli-implementation.js', {
			meow: {default: () => ({input: ['patch'], flags: {provenance, publish}, pkg: npPackage})},
			'update-notifier': {default: () => ({notify() {}})},
			'../source/config.js': {default: async () => ({})},
			'../source/package-manager/index.js': {getPackageManagerConfig: () => packageManager},
			'../source/util.js': {
				readPackage: async () => ({package_: {name: 'fixture', version: '1.0.0'}, rootDirectory: '/project'}),
				getPreReleasePrefix: async () => '',
			},
			'../source/npm/util.js': {
				isPackageNameAvailable: async () => ({isAvailable: false, isUnknown: false}),
				getFilesToBePacked: async () => [],
				username: async () => 'fixture-user',
			},
			'../source/git-util.js': {defaultBranch: async () => 'main'},
			'../source/git-tasks.js': {async verifyGitTasks() {}},
			'../source/ui.js': {
				async default(options) {
					isPrompted = true;
					return {...options, confirm: true, version: '1.0.1'};
				},
			},
			'../source/index.js': {
				async default() {
					isReleased = true;
					return {name: 'fixture', version: '1.0.1'};
				},
			},
			execa: {execa: async () => ({stdout: version})},
			'exit-hook': {
				gracefulExit(code) {
					exitCode = code;
				},
			},
		});
		assert.equal(isPrompted, !shouldReject, 'Unsupported provenance must be rejected before the release wizard can start.');
		assert.equal(isReleased, !shouldReject, 'Unsupported provenance must not execute the release workflow.');
		assert.equal(exitCode, shouldReject ? 1 : undefined);
		assert.match(reportedError ?? '', shouldReject ? /provenance.*yarn.*4\.9\.0/iv : /^$/v);
		assert.doesNotMatch(reportedError ?? '', /^ +at /mv, 'Expected errors must not print a stack trace.');
	});
}
