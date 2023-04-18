import test from 'ava';
import sinon from 'sinon';
import {npPkg} from '../../../source/util.js';
import {mockInquirer} from '../../_helpers/mock-inquirer.js';

const testUi = test.macro(async (t, version, tags, answers, assertions) => {
	const ui = await mockInquirer({t, answers: {confirm: true, ...answers}, mocks: {
		'./npm/util.js': {
			getRegistryUrl: sinon.stub().resolves(''),
			checkIgnoreStrategy: sinon.stub(),
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

	const consoleLog = console.log;
	const logs = [];

	globalThis.console.log = (...args) => logs.push(...args);

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

	globalThis.console.log = consoleLog;

	await assertions({t, results, logs});
});

test.serial('choose next', testUi, '0.0.0', ['next'], {
	version: 'prerelease',
	tag: 'next',
}, ({t, results: {version, tag}}) => {
	t.is(version.toString(), '0.0.1-0');
	t.is(tag, 'next');
});

test.serial('choose beta', testUi, '0.0.0', ['beta', 'stable'], {
	version: 'prerelease',
	tag: 'beta',
}, ({t, results: {version, tag}}) => {
	t.is(version.toString(), '0.0.1-0');
	t.is(tag, 'beta');
});

test.serial('choose custom', testUi, '0.0.0', ['next'], {
	version: 'prerelease',
	tag: 'Other (specify)',
	customTag: 'alpha',
}, ({t, results: {version, tag}}) => {
	t.is(version.toString(), '0.0.1-0');
	t.is(tag, 'alpha');
});

test.serial('choose custom - validation', testUi, '0.0.0', ['next'], {
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
	test.serial(`works for ${version}`, testUi, '0.0.0', ['next'], {
		version,
		tag: 'next',
	}, ({t, results: {version, tag}}) => {
		t.is(version.toString(), expected);
		t.is(tag, 'next');
	});
}
