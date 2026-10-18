import test from 'node:test';
import assert from 'node:assert/strict';
import esmock from 'esmock';
import {npmConfig} from '../../source/package-manager/configs.js';
import {mockInquirer} from '../_helpers/mock-inquirer.js';
import {run} from '../_helpers/task-list.js';

for (const {input, tag, currentVersion = '1.0.0', prereleasePrefix = 'beta', expectedVersion = '1.0.1-beta.0'} of [
	{input: 'prepatch', tag: 'next'},
	{input: 'prepatch'},
	{input: '1.0.1-beta.0', tag: 'next'},
	{input: 'patch', expectedVersion: '1.0.1'},
	{
		input: 'prepatch', tag: 'next', prereleasePrefix: '', expectedVersion: '1.0.1-0',
	},
	{
		input: 'prerelease', tag: 'next', currentVersion: '1.0.1-beta.4', expectedVersion: '1.0.1-beta.5',
	},
	{input: '1.0.1-rc.2', tag: 'next', expectedVersion: '1.0.1-rc.2'},
]) {
	test(`CLI version ${input} with tag ${tag} validates resolved version ${expectedVersion}`, async t => {
		const {ui} = await mockInquirer({
			t,
			answers: {tag: 'next'},
			mocks: {
				'./npm/util.js': {
					async checkIgnoreStrategy() {},
					async prereleaseTags() {
						return ['next'];
					},
				},
				'./util.js': {
					async getNewFiles() {
						return {firstTime: [], unpublished: []};
					},
					async getNewDependencies() {
						return [];
					},
					async getPreReleasePrefix() {
						return prereleasePrefix;
					},
				},
				'./git-util.js': {
					async latestTagOrFirstCommit() {
						return 'v1.0.0';
					},
					async commitLogFromRevision() {
						return '';
					},
				},
				execa: {execa: async () => ({stdout: 'https://registry.npmjs.org/'})},
			},
		});
		const package_ = {name: 'fixture', version: currentVersion, files: ['*']};
		const options = await ui({
			packageManager: npmConfig, runPublish: true, availability: {}, version: input, tag,
		}, {package_});
		assert.equal(options.version.toString(), expectedVersion);
		let validatedTag;
		const prerequisiteTasks = await esmock('../../source/prerequisite-tasks.js', {
			execa: {execa: async () => ({stdout: '12.0.0'})},
			'../../source/util.js': {
				validateEngineVersionSatisfies() {},
				async getTagVersionPrefix() {
					return 'v';
				},
			},
			'../../source/git-util.js': {
				async hasUpstream() {
					return false;
				},
				async verifyRecentGitVersion() {},
				async verifyUserConfigIsSet() {},
				async verifyRemoteIsValid() {},
				async fetch() {},
				async verifyTagDoesNotExistOnRemote(tagName) {
					validatedTag = tagName;
				},
			},
			'../../source/npm/util.js': {async checkConnection() {}},
		});

		await run(prerequisiteTasks(options.version.toString(), package_, {...options, yolo: true}, {packageManager: npmConfig}));
		assert.equal(validatedTag, `v${expectedVersion}`);
	});
}
