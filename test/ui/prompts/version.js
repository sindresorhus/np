import test from 'ava';
import sinon from 'sinon';
import {mockInquirer} from '../../_helpers/mock-inquirer.js';

const testUi = test.macro(async (t, version, answers, assertions) => {
	const ui = await mockInquirer({t, answers: {confirm: true, ...answers}, mocks: {
		'./npm/util.js': {
			getRegistryUrl: sinon.stub().resolves(''),
			checkIgnoreStrategy: sinon.stub().resolves(),
		},
		'./util.js': {
			getNewFiles: sinon.stub().resolves({unpublished: [], firstTime: []}),
			getNewDependencies: sinon.stub().resolves([]),
		},
		'./git-util.js': {
			latestTagOrFirstCommit: sinon.stub().resolves('v1.0.0'),
			commitLogFromRevision: sinon.stub().resolves(''),
		},
	}});

	const consoleLog = console.log;
	const logs = [];

	globalThis.console.log = (...args) => logs.push(...args);

	const results = await ui({
		runPublish: false,
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

test.serial('choose major', testUi, '0.0.0', {
	version: 'major',
}, ({t, results: {version}}) => {
	t.is(version.toString(), '1.0.0');
});

test.serial('choose minor', testUi, '0.0.0', {
	version: 'minor',
}, ({t, results: {version}}) => {
	t.is(version.toString(), '0.1.0');
});

test.serial('choose patch', testUi, '0.0.0', {
	version: 'patch',
}, ({t, results: {version}}) => {
	t.is(version.toString(), '0.0.1');
});

test.serial('choose premajor', testUi, '0.0.0', {
	version: 'premajor',
}, ({t, results: {version}}) => {
	t.is(version.toString(), '1.0.0-0');
});

test.serial('choose preminor', testUi, '0.0.0', {
	version: 'preminor',
}, ({t, results: {version}}) => {
	t.is(version.toString(), '0.1.0-0');
});

test.serial('choose prepatch', testUi, '0.0.0', {
	version: 'prepatch',
}, ({t, results: {version}}) => {
	t.is(version.toString(), '0.0.1-0');
});

test.serial('choose prerelease', testUi, '0.0.1-0', {
	version: 'prerelease',
}, ({t, results: {version}}) => {
	t.is(version.toString(), '0.0.1-1');
});

test.serial('choose custom', testUi, '0.0.0', {
	version: 'Other (specify)',
	customVersion: '1.0.0',
}, ({t, results: {version}}) => {
	t.is(version.toString(), '1.0.0');
});

test.serial('choose custom - validation', testUi, '1.0.0', {
	version: 'Other (specify)',
	customVersion: [
		{
			input: 'major',
			error: 'Custom version should not be a `SemVer` increment.',
		},
		{
			input: '200',
			error: 'Custom version `200` should be a valid `SemVer` version.',
		},
		{
			input: '0.0.0',
			error: 'Custom version `0.0.0` should be higher than current version `1.0.0`.',
		},
		{
			input: '1.0.0',
			error: 'Custom version `1.0.0` should be higher than current version `1.0.0`.',
		},
		{
			input: '2.0.0',
		},
	],
}, ({t, results: {version}}) => {
	t.is(version.toString(), '2.0.0');
});
