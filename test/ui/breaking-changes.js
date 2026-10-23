import process from 'node:process';
import test from 'node:test';
import assert from 'node:assert/strict';
import esmock from 'esmock';
import {execa} from 'execa';
import {npmConfig} from '../../source/package-manager/configs.js';
import {createIntegrationTest} from '../_helpers/integration-test.js';
import {mockInquirer} from '../_helpers/mock-inquirer.js';

const testUi = async (t, {currentVersion = '1.2.3', reasons = ['Commit marked as breaking: feat!: remove old API'], version, releaseDraftOnly = false, runPublish = false, answers = {version: 'patch'}, commitLog = 'feat!: remove old API abc1234', tag} = {}) => {
	let versionPrompt;
	let detectionCount = 0;
	const {ui, logs} = await mockInquirer({
		t,
		answers,
		onPrompt(prompts) {
			versionPrompt = prompts.version;
		},
		mocks: {
			'./breaking-changes.js': {
				async default() {
					detectionCount++;
					return reasons;
				},
			},
			'./util.js': {
				getPreReleasePrefix: async () => '',
				getNewFiles: async () => ({firstTime: [], unpublished: []}),
				getNewDependencies: async () => [],
			},
			'./npm/util.js': {
				async checkIgnoreStrategy() {},
				prereleaseTags: async () => ['next'],
			},
			'./git-util.js': {
				latestTagOrFirstCommit: async () => 'v1.0.0',
				previousTagOrFirstCommit: async () => 'v1.0.0',
				latestTag: async () => 'v1.2.3',
				commitLogFromRevision: async (_revision, endRevision) => endRevision === 'v1.2.3' || !releaseDraftOnly ? commitLog : '',
			},
			execa: {execa: async () => ({stdout: 'https://registry.npmjs.org/'})},
		},
	});

	const result = await ui({
		packageManager: npmConfig,
		runPublish,
		availability: {},
		version,
		releaseDraftOnly,
		tag,
	}, {package_: {name: 'fixture', version: currentVersion}, rootDirectory: process.cwd()});

	return {
		result, logs, versionPrompt, detectionCount,
	};
};

for (const {name, currentVersion, reasons, runPublish, expectedDefault, expectedVersion} of [
	{
		name: 'stable release', runPublish: true, expectedDefault: 'major', expectedVersion: '1.2.4',
	},
	{name: 'release without publishing', expectedDefault: 'major', expectedVersion: '1.2.4'},
	{
		name: 'pre-1.0 release', currentVersion: '0.2.3', expectedDefault: 'minor', expectedVersion: '0.2.4',
	},
	{
		name: 'prerelease', currentVersion: '2.0.0-beta.0', expectedDefault: 'patch', expectedVersion: '2.0.0',
	},
	{
		name: 'no breaking changes', reasons: [], expectedDefault: 'patch', expectedVersion: '1.2.4',
	},
	{
		name: 'pre-0.1 release', currentVersion: '0.0.4', expectedDefault: 'minor', expectedVersion: '0.0.5',
	},
	{
		name: 'numeric prerelease', currentVersion: '2.0.0-0', expectedDefault: 'patch', expectedVersion: '2.0.0',
	},
]) {
	test(`breaking-change suggestions: ${name}`, async t => {
		const {result, logs, versionPrompt, detectionCount} = await testUi(t, {currentVersion, reasons, runPublish});

		assert.equal(detectionCount, 1);
		assert.equal(versionPrompt.default, expectedDefault);
		assert.deepEqual(versionPrompt.choices.filter(choice => choice.value).map(choice => choice.value), [
			'patch', 'minor', 'major', 'prepatch', 'preminor', 'premajor', 'prerelease',
		]);
		assert.ok(versionPrompt.choices.filter(choice => choice.value).every(choice => !choice.disabled));
		assert.equal(result.version.toString(), expectedVersion, 'the user can choose a different increment');
		const warnings = logs.filter(log => log.includes('Potentially breaking changes detected'));
		assert.equal(warnings.length, reasons?.length === 0 ? 0 : 1);
		assert.equal(warnings[0]?.includes('Commit marked as breaking: feat!: remove old API') ?? false, reasons?.length !== 0);
	});
}

for (const {name, version, releaseDraftOnly, runPublish, tag, answers, expectedVersion, expectedTag} of [
	{name: 'explicit increment', version: 'patch', expectedVersion: '1.2.4'},
	{name: 'explicit version', version: '1.3.0', expectedVersion: '1.3.0'},
	{
		name: 'release draft', version: '1.2.3', releaseDraftOnly: true, expectedVersion: '1.2.3',
	},
	{
		name: 'explicit prerelease requiring a tag prompt', version: 'premajor', runPublish: true, answers: {tag: 'next'}, expectedVersion: '2.0.0-0', expectedTag: 'next',
	},
	{
		name: 'explicit prerelease with a tag', version: '2.0.0-beta.0', runPublish: true, tag: 'next', answers: {}, expectedVersion: '2.0.0-beta.0', expectedTag: 'next',
	},
]) {
	test(`breaking-change suggestions skip ${name}`, async t => {
		const {result, logs, versionPrompt, detectionCount} = await testUi(t, {
			version, releaseDraftOnly, runPublish, tag, answers,
		});

		assert.equal(detectionCount, 0);
		assert.equal(versionPrompt, undefined);
		assert.equal(result.version.toString(), expectedVersion);
		assert.equal(result.tag, expectedTag);
		assert.ok(logs.every(log => !log.includes('Potentially breaking changes detected')));
	});
}

test('breaking-change warnings remove terminal control characters', async t => {
	const {logs} = await testUi(t, {reasons: ['Commit marked as breaking: feat!: remove\u{7}\r\n\u{9B} API\u{1B}[2J']});
	const warning = logs.find(log => log.includes('Potentially breaking changes detected'));

	assert.ok(warning.includes('Commit marked as breaking: feat!: remove API[2J'));
});

test('lists every reason in one warning and preserves Unicode text', async t => {
	const reasons = [
		'Node.js support reduced: >=18 → >=20',
		'The package.json "exports" field was introduced, which can restrict access to package entry points',
		'Commit marked as breaking: feat!: 新しい API 🚀',
	];
	const {logs} = await testUi(t, {reasons});
	const warnings = logs.filter(log => log.includes('Potentially breaking changes detected'));

	assert.equal(warnings.length, 1);
	assert.ok(reasons.every(reason => warnings[0].includes(`- ${reason}`)));
});

test('a suggested major release still allows a custom version', async t => {
	const {result, versionPrompt} = await testUi(t, {answers: {version: 'Other (specify)', customVersion: '2.5.0'}});

	assert.equal(versionPrompt.default, 'major');
	assert.equal(result.version.toString(), '2.5.0');
});

test('a suggested major release still allows a prerelease with its own identifier and tag', async t => {
	const {result, versionPrompt} = await testUi(t, {
		runPublish: true,
		answers: {version: 'premajor', prereleasePrefix: 'beta', tag: 'next'},
	});

	assert.equal(versionPrompt.default, 'major');
	assert.equal(result.version.toString(), '2.0.0-beta.0');
	assert.equal(result.tag, 'next');
});

test('cancelling a release with no commits skips detection', async t => {
	const {result, logs, versionPrompt, detectionCount} = await testUi(t, {commitLog: '', answers: {confirm: false}});

	assert.equal(result.confirm, false);
	assert.equal(detectionCount, 0);
	assert.equal(versionPrompt, undefined);
	assert.ok(logs.every(log => !log.includes('Potentially breaking changes detected')));
});

test('real Git changes warn before the picker while release notes keep only commit subjects', async t => {
	await createIntegrationTest(t, async ({context, $$, temporaryDirectory}) => {
		await context.createFile('package.json', JSON.stringify({version: '1.0.0', engines: {node: '>=18'}}));
		await $$`git add .`;
		await $$`git commit -m ${'initial release'}`;
		await $$`git tag v1.0.0`;
		await context.createFile('package.json', JSON.stringify({version: '1.0.0', engines: {node: '>=20'}}));
		await $$`git add .`;
		await $$`git commit -m ${'feat: update API'} -m ${'BREAKING CHANGE: remove old API'}`;
		const getPotentialBreakingChanges = await esmock('../../source/breaking-changes.js', import.meta.url, {}, {
			execa: {execa: async (command, arguments_, options = {}) => execa(command, arguments_, {...options, cwd: temporaryDirectory})},
		});
		let promptDefault;
		let logsBeforePrompt;
		const answers = {};
		const {ui, logs} = await mockInquirer({
			t,
			answers,
			onPrompt(prompts) {
				promptDefault = prompts.version.default;
				answers.version = promptDefault;
				logsBeforePrompt = logs.join('\n');
			},
			mocks: {
				'./breaking-changes.js': {default: getPotentialBreakingChanges},
				'./util.js': {getPreReleasePrefix: async () => ''},
				execa: {
					execa: async (command, arguments_, options = {}) => command === 'npm'
						? {stdout: 'https://registry.npmjs.org/'}
						: execa(command, arguments_, {...options, cwd: temporaryDirectory}),
				},
			},
		});
		const result = await ui({packageManager: npmConfig, runPublish: false, availability: {}}, {
			package_: {
				name: 'fixture', version: '1.0.0', engines: {node: '>=20'}, repository: {url: 'https://github.com/fixture/repo'},
			},
			rootDirectory: temporaryDirectory,
		});

		assert.equal(promptDefault, 'major');
		assert.ok(logsBeforePrompt.includes('Node.js support reduced: >=18 → >=20'));
		assert.ok(logsBeforePrompt.includes('Commit marked as breaking: feat: update API'));
		assert.equal(result.version.toString(), '2.0.0');
		const notes = result.generateReleaseNotes('v2.0.0');
		assert.ok(notes.includes('feat: update API'));
		assert.ok(!notes.includes('BREAKING CHANGE:'));
		assert.ok(notes.includes('https://github.com/fixture/repo/compare/v1.0.0...v2.0.0'));
	});
});

test('accepting the suggestion for a changelog-only breaking change before 1.0 bumps the minor version', async t => {
	await createIntegrationTest(t, async ({context, $$, temporaryDirectory}) => {
		await context.createFile('package.json', JSON.stringify({version: '0.3.4'}));
		await context.createFile('CHANGELOG.md', '## Unreleased\n### Breaking\n');
		await $$`git add .`;
		await $$`git commit -m ${'initial release'}`;
		await $$`git tag v0.3.4`;
		await context.createFile('CHANGELOG.md', '## Unreleased\n### Breaking\n- Remove old API\n');
		await $$`git add .`;
		await $$`git commit -m ${'Document API changes'}`;
		const getPotentialBreakingChanges = await esmock('../../source/breaking-changes.js', import.meta.url, {}, {
			execa: {execa: async (command, arguments_, options = {}) => execa(command, arguments_, {...options, cwd: temporaryDirectory})},
		});
		const answers = {};
		const {ui, logs} = await mockInquirer({
			t,
			answers,
			onPrompt(prompts) {
				answers.version = prompts.version.default;
			},
			mocks: {
				'./breaking-changes.js': {default: getPotentialBreakingChanges},
				'./util.js': {getPreReleasePrefix: async () => ''},
				execa: {
					execa: async (command, arguments_, options = {}) => command === 'npm'
						? {stdout: 'https://registry.npmjs.org/'}
						: execa(command, arguments_, {...options, cwd: temporaryDirectory}),
				},
			},
		});
		const result = await ui({packageManager: npmConfig, runPublish: false, availability: {}}, {
			package_: {name: 'fixture', version: '0.3.4'}, rootDirectory: temporaryDirectory,
		});

		assert.equal(answers.version, 'minor');
		assert.equal(result.version.toString(), '0.4.0');
		const output = logs.join('\n');
		assert.ok(output.includes('Changelog marks changes as breaking (CHANGELOG.md): Remove old API'));
		assert.ok(!output.includes('Commit marked as breaking:'));
	});
});
