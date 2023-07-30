import test from 'ava';
import sinon from 'sinon';
import {npPkg} from '../../../source/util.js';
import {mockInquirer} from '../../_helpers/mock-inquirer.js';

const testUi = test.macro(async (t, {version, tags, answers}, assertions) => {
	const {ui, logs} = await mockInquirer({t, answers: {confirm: true, ...answers}, mocks: {
		'./npm/util.js': {
			getRegistryUrl: sinon.stub().resolves(''),
			checkIgnoreStrategy: sinon.stub().resolves(),
			prereleaseTags: sinon.stub().resolves(tags),
		},
		'./util.js': {
			getNewFiles: sinon.stub().resolves({unpublished: [], firstTime: []}),
			getNewDependencies: sinon.stub().resolves([]),
		},
		'./git-util.js': {
			latestTagOrFirstCommit: sinon.stub().resolves(`v${npPkg.version}`),
			commitLogFromRevision: sinon.stub().resolves(''),
		},
	}});

	const results = await ui({
		runPublish: true,
		availability: {},
	}, {
		pkg: {
			name: 'foo',
			version,
			files: ['*'],
		},
	});

	await assertions({t, results, logs});
});

test('choose next', testUi, {
	version: '0.0.0',
	tags: ['next'],
	answers: {
		version: 'prerelease',
		tag: 'next',
	},
}, ({t, results: {version, tag}}) => {
	t.is(version.toString(), '0.0.1-0');
	t.is(tag, 'next');
});

test('choose beta', testUi, {
	version: '0.0.0',
	tags: ['beta', 'stable'],
	answers: {
		version: 'prerelease',
		tag: 'beta',
	},
}, ({t, results: {version, tag}}) => {
	t.is(version.toString(), '0.0.1-0');
	t.is(tag, 'beta');
});

test('choose custom', testUi, {
	version: '0.0.0',
	tags: ['next'],
	answers: {
		version: 'prerelease',
		tag: 'Other (specify)',
		customTag: 'alpha',
	},
}, ({t, results: {version, tag}}) => {
	t.is(version.toString(), '0.0.1-0');
	t.is(tag, 'alpha');
});

test('choose custom - validation', testUi, {
	version: '0.0.0',
	tags: ['next'],
	answers: {
		version: 'prerelease',
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
}, ({t, results: {version, tag}}) => {
	t.is(version.toString(), '0.0.1-0');
	t.is(tag, 'alpha');
});

// Assuming from version 0.0.0
const fixtures = [
	{version: 'premajor', expected: '1.0.0-0'},
	{version: 'preminor', expected: '0.1.0-0'},
	{version: 'prepatch', expected: '0.0.1-0'},
	{version: 'prerelease', expected: '0.0.1-0'},
];

for (const {version, expected} of fixtures) {
	test(`works for ${version}`, testUi, {
		version: '0.0.0',
		tags: ['next'],
		answers: {
			version,
			tag: 'next',
		},
	}, ({t, results: {version, tag}}) => {
		t.is(version.toString(), expected);
		t.is(tag, 'next');
	});
}
