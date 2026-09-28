import test from 'node:test';
import assert from 'node:assert/strict';
import sinon from 'sinon';
import {npmConfig as packageManager} from '../../../source/package-manager/configs.js';
import {npPackage} from '../../../source/util.js';
import {mockInquirer} from '../../_helpers/mock-inquirer.js';

const testUi = (title, {version, tags, answers}, assertions) => {
	test(title, async t => {
		const {ui, logs} = await mockInquirer({
			t, answers: {confirm: true, ...answers}, mocks: {
				'./npm/util.js': {
					checkIgnoreStrategy: sinon.stub().resolves(),
					prereleaseTags: sinon.stub().resolves(tags),
				},
				'./util.js': {
					getNewFiles: sinon.stub().resolves({unpublished: [], firstTime: []}),
					getNewDependencies: sinon.stub().resolves([]),
					getPreReleasePrefix: sinon.stub().resolves(''),
				},
				'./git-util.js': {
					latestTagOrFirstCommit: sinon.stub().resolves(`v${npPackage.version}`),
					commitLogFromRevision: sinon.stub().resolves(''),
				},
				'./package-manager/index.js': {
					findLockfile: sinon.stub().resolves(undefined),
				},
				execa: {
					execa: sinon.stub().resolves({stdout: 'https://registry.npmjs.org/'}),
				},
			},
		});

		const results = await ui({
			packageManager,
			runPublish: true,
			availability: {},
		}, {
			package_: {
				name: 'foo',
				version,
				files: ['*'],
			},
		});

		await assertions({results, logs});
	});
};

testUi('choose next', {
	version: '0.0.0',
	tags: ['next'],
	answers: {
		version: 'prerelease',
		prereleasePrefix: '',
		tag: 'next',
	},
}, ({results: {version, tag}}) => {
	assert.equal(version.toString(), '0.0.1-0');
	assert.equal(tag, 'next');
});

testUi('choose beta', {
	version: '0.0.0',
	tags: ['beta', 'stable'],
	answers: {
		version: 'prerelease',
		prereleasePrefix: '',
		tag: 'beta',
	},
}, ({results: {version, tag}}) => {
	assert.equal(version.toString(), '0.0.1-0');
	assert.equal(tag, 'beta');
});

testUi('choose custom', {
	version: '0.0.0',
	tags: ['next'],
	answers: {
		version: 'prerelease',
		prereleasePrefix: '',
		tag: 'Other (specify)',
		customTag: 'alpha',
	},
}, ({results: {version, tag}}) => {
	assert.equal(version.toString(), '0.0.1-0');
	assert.equal(tag, 'alpha');
});

testUi('choose custom - validation', {
	version: '0.0.0',
	tags: ['next'],
	answers: {
		version: 'prerelease',
		prereleasePrefix: '',
		tag: 'Other (specify)',
		customTag: [
			{
				input: '',
				error: 'Please specify a tag, for example, `next`.',
			},
			{
				input: 'latest',
				error: 'It\'s not possible to publish pre-releases under the `latest` tag. Please specify something else, for example, `next`.',
			},
			{
				input: 'LAteSt',
				error: 'It\'s not possible to publish pre-releases under the `latest` tag. Please specify something else, for example, `next`.',
			},
			{
				input: 'alpha',
			},
		],
	},
}, ({results: {version, tag}}) => {
	assert.equal(version.toString(), '0.0.1-0');
	assert.equal(tag, 'alpha');
});

// Assuming from version 0.0.0
const fixtures = [
	{version: 'premajor', expected: '1.0.0-0'},
	{version: 'preminor', expected: '0.1.0-0'},
	{version: 'prepatch', expected: '0.0.1-0'},
	{version: 'prerelease', expected: '0.0.1-0'},
];

for (const {version, expected} of fixtures) {
	testUi(`works for ${version}`, {
		version: '0.0.0',
		tags: ['next'],
		answers: {
			version,
			prereleasePrefix: '',
			tag: 'next',
		},
	}, ({results: {version: newVersion, tag}}) => {
		assert.equal(newVersion.toString(), expected);
		assert.equal(tag, 'next');
	});
}

// Test that prerelease versions provided via CLI prompt for tag
for (const {version} of fixtures) {
	test(`prompts for tag when ${version} is provided via CLI`, async t => {
		const {ui} = await mockInquirer({
			t, answers: {tag: 'next', confirm: true}, mocks: {
				'./npm/util.js': {
					checkIgnoreStrategy: sinon.stub().resolves(),
					prereleaseTags: sinon.stub().resolves(['next']),
				},
				'./util.js': {
					getNewFiles: sinon.stub().resolves({unpublished: [], firstTime: []}),
					getNewDependencies: sinon.stub().resolves([]),
					getPreReleasePrefix: sinon.stub().resolves(''),
				},
				'./git-util.js': {
					latestTagOrFirstCommit: sinon.stub().resolves(`v${npPackage.version}`),
					commitLogFromRevision: sinon.stub().resolves(''),
				},
				'./package-manager/index.js': {
					findLockfile: sinon.stub().resolves(undefined),
				},
				execa: {
					execa: sinon.stub().resolves({stdout: 'https://registry.npmjs.org/'}),
				},
			},
		});

		const results = await ui({
			packageManager,
			runPublish: true,
			availability: {},
			version,
		}, {
			package_: {
				name: 'foo',
				version: '0.0.0',
				files: ['*'],
			},
		});

		// Verify that the tag was set via prompt
		assert.equal(results.tag, 'next');
	});
}
